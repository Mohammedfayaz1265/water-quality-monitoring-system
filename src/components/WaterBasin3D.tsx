import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Eye,
  Pause,
  Play,
  RotateCcw,
  Waves,
} from 'lucide-react';
import { MonitoringStation, WaterSample } from '../types/wqms';
import { formatDateTime } from '../utils/classification';
import {
  createRadialShadowTexture,
  detectSoftwareWebGL,
  disposeSceneResources,
} from '../utils/webglHelpers';
import { SampleStatusLabel } from './StatusText';

interface WaterBasin3DProps {
  stations: MonitoringStation[];
  samples: WaterSample[];
  animate: boolean;
  onSelectStationSamples?: (stationId: string) => void;
}

type CameraPreset = 'overview' | 'waterline' | 'top';

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [7.8, 5.2, 8.6], target: [0, 0.35, 0] },
  waterline: { pos: [8.8, 1.85, 6.2], target: [0, 0.55, 0] },
  top: { pos: [0.01, 11.2, 2.2], target: [0, 0, 0] },
};

// Pre-allocated math helpers outside render loop (zero GC)
const _dummy = new THREE.Object3D();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

export function WaterBasin3D({
  stations,
  samples,
  animate,
  onSelectStationSamples,
}: WaterBasin3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    () => stations[0]?.id ?? null
  );
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(!animate);
  const [activePreset, setActivePreset] = useState<CameraPreset>('overview');
  const [webglError, setWebglError] = useState(false);

  const stationLatestMap = useMemo(() => {
    const map = new Map<string, WaterSample | null>();
    for (const st of stations) {
      const latest =
        [...samples]
          .filter((s) => s.stationId === st.id)
          .sort(
            (a, b) =>
              new Date(b.collectionDate).getTime() -
              new Date(a.collectionDate).getTime()
          )[0] ?? null;
      map.set(st.id, latest);
    }
    return map;
  }, [stations, samples]);

  const stationsDataRef = useRef({
    stations,
    stationLatestMap,
    isPaused,
    selectedStationId,
  });
  stationsDataRef.current = {
    stations,
    stationLatestMap,
    isPaused,
    selectedStationId,
  };

  const presetGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(...CAMERA_PRESETS.overview.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.overview.target),
    active: false,
  });

  useEffect(() => {
    setIsPaused(!animate);
  }, [animate]);

  // Keep selectedStationId valid if stations change
  useEffect(() => {
    if (
      selectedStationId &&
      !stations.some((s) => s.id === selectedStationId)
    ) {
      setSelectedStationId(stations[0]?.id ?? null);
    }
  }, [stations, selectedStationId]);

  const triggerPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    presetGoalRef.current = {
      pos: new THREE.Vector3(...CAMERA_PRESETS[preset].pos),
      target: new THREE.Vector3(...CAMERA_PRESETS[preset].target),
      active: true,
    };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 360;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061124);
    scene.fog = new THREE.FogExp2(0x061124, 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.5;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minPolarAngle = 0.2;
    controls.target.set(...CAMERA_PRESETS.overview.target);

    const onControlStart = () => {
      presetGoalRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // Three-Point Studio + Ocean Atmospheric Lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x071429, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.9);
    keyLight.position.set(7, 11, 6);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.35);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    const aquaFill = new THREE.PointLight(0x14b8a6, 2.2, 22, 1.5);
    aquaFill.position.set(0, 2.5, 0);
    scene.add(aquaFill);

    // Circular Basin Floor + Metallic Perimeter Collar (multi-part environment)
    const basinFloorGeo = new THREE.CylinderGeometry(5.6, 5.8, 0.35, 64);
    const basinFloorMat = new THREE.MeshStandardMaterial({
      color: 0x081a36,
      roughness: 0.78,
      metalness: 0.2,
    });
    const basinFloor = new THREE.Mesh(basinFloorGeo, basinFloorMat);
    basinFloor.position.y = -0.55;
    basinFloor.receiveShadow = true;
    scene.add(basinFloor);

    const contactShadowTex = createRadialShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11.4, 11.4),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.48,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.35;
    scene.add(shadowPlane);

    const outerRimGeo = new THREE.TorusGeometry(5.55, 0.14, 20, 72);
    const outerRimMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.28,
      metalness: 0.85,
    });
    const outerRim = new THREE.Mesh(outerRimGeo, outerRimMat);
    outerRim.rotation.x = Math.PI / 2;
    outerRim.position.y = 0.08;
    scene.add(outerRim);

    const innerGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.32, 0.04, 16, 72),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    innerGlowRing.rotation.x = Math.PI / 2;
    innerGlowRing.position.y = 0.08;
    scene.add(innerGlowRing);

    // Animated Undulating Water Surface Mesh
    const waterRadius = 5.3;
    const waterGeo = new THREE.CircleGeometry(waterRadius, 72);
    // Subdivide radial rings using PlaneGeometry clipped or Ring-like vertex grid for smooth wave ripples
    waterGeo.dispose();

    const waveSegments = 44;
    const wavePlane = new THREE.PlaneGeometry(
      waterRadius * 2,
      waterRadius * 2,
      waveSegments,
      waveSegments
    );
    wavePlane.rotateX(-Math.PI / 2);

    // Sculpt circular mask by snapping vertices outside radius cleanly onto rim
    const posAttr = wavePlane.attributes.position as THREE.BufferAttribute;
    const basePositions = new Float32Array(posAttr.array.length);
    const colors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);
      const r = Math.hypot(x, z);
      if (r > waterRadius) {
        const scale = waterRadius / r;
        x *= scale;
        z *= scale;
        posAttr.setXYZ(i, x, 0, z);
      }
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = 0;
      basePositions[i * 3 + 2] = z;

      // Rich sapphire-to-cyan-to-teal depth gradient
      const radialT = Math.min(r / waterRadius, 1);
      colors[i * 3] = THREE.MathUtils.lerp(0.04, 0.08, radialT);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.72, 0.36, radialT);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.86, 0.72, radialT);
    }
    wavePlane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    wavePlane.computeVertexNormals();

    const waterMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color(0x042f4b),
      emissiveIntensity: 0.42,
    });
    const waterMesh = new THREE.Mesh(wavePlane, waterMat);
    waterMesh.position.y = 0.02;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Subtle concentric sonar rings on water
    const sonarRings: THREE.Mesh[] = [];
    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.1 + rIdx * 1.45, 1.13 + rIdx * 1.45, 64),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.28 - rIdx * 0.06,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      ring.userData.baseRadius = 1 + rIdx * 0.2;
      scene.add(ring);
      sonarRings.push(ring);
    }

    // Instanced Floating Dissolved-Oxygen Micro-Bubbles
    const bubbleCount = 54;
    const bubbleGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.75,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78,
    });
    const bubblesMesh = new THREE.InstancedMesh(
      bubbleGeo,
      bubbleMat,
      bubbleCount
    );
    bubblesMesh.frustumCulled = false;

    const bubbleData = Array.from({ length: bubbleCount }, (_, idx) => {
      const angle = (idx / bubbleCount) * Math.PI * 2 + (idx % 5) * 0.7;
      const radius = 0.8 + ((idx * 17) % 40) / 10;
      return {
        angle,
        radius,
        speed: 0.25 + ((idx * 13) % 20) / 35,
        phase: (idx * 0.61) % 1,
        scale: 0.55 + ((idx * 7) % 10) / 14,
        color:
          idx % 3 === 0
            ? new THREE.Color(0x22d3ee)
            : idx % 3 === 1
            ? new THREE.Color(0x34d399)
            : new THREE.Color(0x38bdf8),
      };
    });
    bubbleData.forEach((b, i) => bubblesMesh.setColorAt(i, b.color));
    if (bubblesMesh.instanceColor) bubblesMesh.instanceColor.needsUpdate = true;
    scene.add(bubblesMesh);

    // Composite Procedural Station Towers (5-part THREE.Group per station)
    const stationGroupContainer = new THREE.Group();
    scene.add(stationGroupContainer);

    const clickableTargets: THREE.Object3D[] = [];
    interface StationNodeRef {
      stationId: string;
      group: THREE.Group;
      beaconMat: THREE.MeshStandardMaterial;
      haloMesh: THREE.Mesh;
      haloMat: THREE.MeshStandardMaterial;
      basePos: THREE.Vector3;
      phase: number;
    }
    const stationNodes: StationNodeRef[] = [];

    const buildStationNodes = () => {
      // Clear previous
      while (stationGroupContainer.children.length > 0) {
        const child = stationGroupContainer.children[0];
        stationGroupContainer.remove(child);
      }
      clickableTargets.length = 0;
      stationNodes.length = 0;

      const list = stationsDataRef.current.stations;
      const count = Math.max(list.length, 1);

      list.forEach((st, idx) => {
        const angle = (idx / count) * Math.PI * 2 - Math.PI / 4;
        const dist = count === 1 ? 0 : 2.75;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Part 1: Submerged Base Plinth (matte dark slate)
        const plinth = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.54, 0.45, 24),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.78,
            metalness: 0.25,
          })
        );
        plinth.position.y = -0.18;
        plinth.castShadow = true;
        group.add(plinth);

        // Part 2: Anodized Buoyant Collar (brushed cobalt-titanium)
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.4, 0.22, 24),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.26,
            metalness: 0.85,
          })
        );
        collar.position.y = 0.14;
        collar.castShadow = true;
        group.add(collar);

        // Part 3: Vertical Telemetry Mast (machined silver-navy steel)
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.11, 1.35, 16),
          new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            roughness: 0.22,
            metalness: 0.9,
          })
        );
        mast.position.y = 0.85;
        mast.castShadow = true;
        group.add(mast);

        // Part 4: Status Beacon Crystal Dome (colour-coded by latest sample)
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 1.15,
          roughness: 0.12,
          metalness: 0.3,
        });
        const beacon = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 1),
          beaconMat
        );
        beacon.position.y = 1.66;
        group.add(beacon);

        // Part 5: Orbiting Status Halo Ring
        const haloMat = new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.9,
          roughness: 0.25,
          metalness: 0.7,
        });
        const haloMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.032, 12, 36),
          haloMat
        );
        haloMesh.rotation.x = Math.PI / 2;
        haloMesh.position.y = 1.66;
        group.add(haloMesh);

        // Hit-test proxy cylinder for responsive click/hover
        const proxy = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.6, 2.2, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        proxy.position.y = 0.9;
        proxy.userData.stationId = st.id;
        group.add(proxy);
        clickableTargets.push(proxy);

        stationGroupContainer.add(group);
        stationNodes.push({
          stationId: st.id,
          group,
          beaconMat,
          haloMesh,
          haloMat,
          basePos: new THREE.Vector3(x, 0, z),
          phase: idx * 1.4,
        });
      });
    };

    buildStationNodes();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for Click & Hover
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(
        ev.clientX - pointerDownPos.x,
        ev.clientY - pointerDownPos.y
      );
      if (dist > 6) return; // Ignore orbit drags
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false);
      if (hits.length > 0) {
        const stId = hits[0].object.userData.stationId as string | undefined;
        if (stId) {
          setSelectedStationId(stId);
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false);
      if (hits.length > 0) {
        const stId = hits[0].object.userData.stationId as string | undefined;
        setHoveredStationId(stId ?? null);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredStationId(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      onContextRestored
    );

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let knownStationSignature = stationsDataRef.current.stations
      .map((s) => s.id)
      .join('|');

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(now: number) {
      if (disposed) return;
      const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;

      const {
        stations: currentStations,
        stationLatestMap: latestMap,
        isPaused: paused,
        selectedStationId: activeId,
      } = stationsDataRef.current;

      // Rebuild station towers if stations array changed
      const sig = currentStations.map((s) => s.id).join('|');
      if (sig !== knownStationSignature) {
        knownStationSignature = sig;
        buildStationNodes();
      }

      if (!paused) {
        simTime += dt;
      }

      // Smooth damped camera preset transitions
      if (presetGoalRef.current.active) {
        _targetPos.copy(presetGoalRef.current.pos);
        _targetLook.copy(presetGoalRef.current.target);
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _targetPos.x,
          5.5,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _targetPos.y,
          5.5,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _targetPos.z,
          5.5,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          _targetLook.x,
          5.5,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          _targetLook.y,
          5.5,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          _targetLook.z,
          5.5,
          dt
        );
        if (camera.position.distanceTo(_targetPos) < 0.03) {
          presetGoalRef.current.active = false;
        }
      }

      controls.update();

      // Update undulating water surface vertices
      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const bz = basePositions[i * 3 + 2];
        const dist = Math.hypot(bx, bz);
        const edgeFade = Math.max(0, 1 - dist / (waterRadius + 0.15));
        const wave =
          (Math.sin(bx * 1.15 + simTime * 1.9) * 0.055 +
            Math.cos(bz * 1.35 - simTime * 1.55) * 0.045 +
            Math.sin(dist * 2.2 - simTime * 2.4) * 0.03) *
          edgeFade;
        posAttr.setY(i, wave);
      }
      posAttr.needsUpdate = true;
      wavePlane.computeVertexNormals();

      // Update rising dissolved-oxygen bubbles
      for (let i = 0; i < bubbleCount; i++) {
        const b = bubbleData[i];
        const cycle = (b.phase + simTime * b.speed) % 1;
        const y = -0.25 + cycle * 2.35;
        const wobbleX = Math.sin(simTime * 1.8 + b.angle) * 0.12;
        const wobbleZ = Math.cos(simTime * 1.6 + b.angle) * 0.12;
        _dummy.position.set(
          Math.cos(b.angle) * b.radius + wobbleX,
          y,
          Math.sin(b.angle) * b.radius + wobbleZ
        );
        const fadeScale = Math.sin(cycle * Math.PI) * b.scale;
        _dummy.scale.setScalar(Math.max(0.01, fadeScale));
        _dummy.updateMatrix();
        bubblesMesh.setMatrixAt(i, _dummy.matrix);
      }
      bubblesMesh.instanceMatrix.needsUpdate = true;

      // Update station beacons & buoyant bobbing
      for (const node of stationNodes) {
        const latest = latestMap.get(node.stationId) ?? null;
        const isAbnormal =
          latest?.status === 'Outside Configured Thresholds';
        const hasSamples = Boolean(latest);
        const isSelected = node.stationId === activeId;

        if (!hasSamples) {
          node.beaconMat.color.setHex(0x38bdf8);
          node.beaconMat.emissive.setHex(0x0284c7);
          node.haloMat.color.setHex(0x38bdf8);
          node.haloMat.emissive.setHex(0x0284c7);
        } else if (isAbnormal) {
          node.beaconMat.color.setHex(0xf43f5e);
          node.beaconMat.emissive.setHex(0xe11d48);
          node.haloMat.color.setHex(0xfb7185);
          node.haloMat.emissive.setHex(0xe11d48);
        } else {
          node.beaconMat.color.setHex(0x10b981);
          node.beaconMat.emissive.setHex(0x059669);
          node.haloMat.color.setHex(0x2dd4bf);
          node.haloMat.emissive.setHex(0x0d9488);
        }

        const bob = Math.sin(simTime * 1.8 + node.phase) * 0.045;
        node.group.position.set(node.basePos.x, bob, node.basePos.z);
        node.haloMesh.rotation.z = simTime * (isSelected ? 1.8 : 0.9);
        const targetScale = isSelected ? 1.18 : 1.0;
        node.group.scale.x = THREE.MathUtils.damp(
          node.group.scale.x,
          targetScale,
          7,
          dt
        );
        node.group.scale.y = node.group.scale.x;
        node.group.scale.z = node.group.scale.x;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onContextRestored
      );
      envTexture.dispose();
      disposeSceneResources(scene);
      renderer.dispose();
    };
  }, []);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) ?? null,
    [stations, selectedStationId]
  );
  const selectedLatest = selectedStation
    ? stationLatestMap.get(selectedStation.id) ?? null
    : null;

  return (
    <div className="bg-[#061124] border border-slate-800 rounded-2xl overflow-hidden shadow-lg text-white">
      {/* Compact Header Strip */}
      <div className="px-5 py-3.5 border-b border-slate-800/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#081730]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shrink-0">
            <Waves className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-tight">
              3D Hydro-Telemetry Basin Simulation
            </h3>
            <p className="text-[11px] text-cyan-200/80">
              Drag to orbit · Scroll to zoom · Click any 3D station beacon to inspect simulated readings
            </p>
          </div>
        </div>

        {/* Camera & Motion Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['overview', 'waterline', 'top'] as CameraPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => triggerPreset(p)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                activePreset === p
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {p === 'top' ? 'Top-Down' : p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            title={isPaused ? 'Resume 3D wave motion' : 'Pause 3D wave motion'}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>Play</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pause</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => triggerPreset('overview')}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Reset camera view"
            aria-label="Reset camera view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Viewport Stage */}
      <div className="relative h-[340px] sm:h-[380px] w-full">
        {webglError ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#061124] via-[#0B2242] to-[#082F49]">
            <Waves className="w-10 h-10 text-cyan-400 mb-3" />
            <p className="text-sm font-semibold text-white">
              3D WebGL Viewport Unavailable
            </p>
            <p className="text-xs text-slate-300 mt-1 max-w-md">
              Your current browser context suspended WebGL rendering. All 2D charts and sample tables below remain fully interactive.
            </p>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        {/* Compact Legend Swatches (Top-Left, no backdrop-filter) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none bg-[#071326]/90 border border-slate-700/80 rounded-lg px-3 py-2 text-[11px] space-y-1">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
            <span>Within Configured Thresholds</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
            <span>Outside Configured Thresholds</span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
            <span>Awaiting Samples</span>
          </div>
        </div>

        {/* Bottom Dock Selected Station Telemetry Card (solid rgba, zero backdrop-blur) */}
        {selectedStation && (
          <div className="absolute bottom-3 left-3 right-3 z-10 bg-[#071326]/92 border border-cyan-500/30 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-cyan-300">
                  {selectedStation.id}
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-semibold text-white truncate">
                  {selectedStation.name}
                </span>
                {hoveredStationId && hoveredStationId !== selectedStation.id && (
                  <span className="text-[11px] text-cyan-300/80 hidden sm:inline">
                    (Hovering: {hoveredStationId})
                  </span>
                )}
              </div>
              {selectedLatest ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                  <div className="bg-white/95 rounded px-2 py-0.5">
                    <SampleStatusLabel status={selectedLatest.status} compact />
                  </div>
                  <span className="font-mono tabular-nums text-cyan-200">
                    pH {selectedLatest.ph.toFixed(2)}
                  </span>
                  <span className="font-mono tabular-nums text-indigo-200">
                    Turb {selectedLatest.turbidity.toFixed(1)} NTU
                  </span>
                  <span className="font-mono tabular-nums text-emerald-200">
                    DO {selectedLatest.dissolvedOxygen.toFixed(1)} mg/L
                  </span>
                  <span className="font-mono tabular-nums text-amber-200">
                    Temp {selectedLatest.temperature.toFixed(1)} °C
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDateTime(selectedLatest.collectionDate)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  No simulated samples logged for this station yet.
                </p>
              )}
            </div>

            {onSelectStationSamples && (
              <button
                type="button"
                onClick={() => onSelectStationSamples(selectedStation.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap self-start md:self-center"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect Station Samples</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
