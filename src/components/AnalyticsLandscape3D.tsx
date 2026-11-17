import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layers, RotateCcw } from 'lucide-react';
import {
  MonitoringStation,
  ParameterName,
  ThresholdConfig,
  WaterSample,
} from '../types/wqms';
import {
  formatDateTime,
  isParameterAbnormal,
} from '../utils/classification';
import {
  createCalibratedGridTexture,
  detectSoftwareWebGL,
  disposeSceneResources,
} from '../utils/webglHelpers';

interface AnalyticsLandscape3DProps {
  samples: WaterSample[];
  stations: MonitoringStation[];
  thresholds: ThresholdConfig;
  animate: boolean;
}

type ColorMode = 'spectrum' | 'status';
type ViewPreset = 'iso' | 'front' | 'side';

interface PillarItem {
  sample: WaterSample;
  stationName: string;
  parameter: ParameterName;
  value: number;
  unit: string;
  normalizedHeight: number;
  isAbnormal: boolean;
}

const PARAM_DEFS: Array<{
  name: ParameterName;
  unit: string;
  hex: number;
  css: string;
  normalize: (s: WaterSample) => number;
}> = [
  {
    name: 'pH',
    unit: 'pH',
    hex: 0x06b6d4,
    css: 'bg-cyan-500',
    normalize: (s) => THREE.MathUtils.clamp((s.ph - 4) / 6, 0.12, 1),
  },
  {
    name: 'Turbidity',
    unit: 'NTU',
    hex: 0x6366f1,
    css: 'bg-indigo-500',
    normalize: (s) => THREE.MathUtils.clamp(s.turbidity / 10, 0.12, 1),
  },
  {
    name: 'Dissolved Oxygen',
    unit: 'mg/L',
    hex: 0x10b981,
    css: 'bg-emerald-500',
    normalize: (s) =>
      THREE.MathUtils.clamp(s.dissolvedOxygen / 12, 0.12, 1),
  },
  {
    name: 'Temperature',
    unit: '°C',
    hex: 0xf59e0b,
    css: 'bg-amber-500',
    normalize: (s) => THREE.MathUtils.clamp(s.temperature / 42, 0.12, 1),
  },
];

const VIEW_PRESETS: Record<
  ViewPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  iso: { pos: [9.5, 6.8, 10.2], target: [0, 1.1, 0] },
  front: { pos: [0, 4.4, 13.5], target: [0, 1.1, 0] },
  side: { pos: [13.2, 4.4, 0.2], target: [0, 1.1, 0] },
};

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

export function AnalyticsLandscape3D({
  samples,
  stations,
  thresholds,
  animate,
}: AnalyticsLandscape3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('spectrum');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('iso');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [webglError, setWebglError] = useState(false);

  const stationMap = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations]
  );

  // Use up to 14 most recent filtered samples chronologically for crisp spatial readability
  const displaySamples = useMemo(() => {
    const sorted = [...samples].sort(
      (a, b) =>
        new Date(a.collectionDate).getTime() -
        new Date(b.collectionDate).getTime()
    );
    return sorted.slice(-14);
  }, [samples]);

  const pillars = useMemo<PillarItem[]>(() => {
    const list: PillarItem[] = [];
    displaySamples.forEach((sample) => {
      const stationName = stationMap.get(sample.stationId) ?? sample.stationId;
      PARAM_DEFS.forEach((def) => {
        const value =
          def.name === 'pH'
            ? sample.ph
            : def.name === 'Turbidity'
            ? sample.turbidity
            : def.name === 'Dissolved Oxygen'
            ? sample.dissolvedOxygen
            : sample.temperature;
        list.push({
          sample,
          stationName,
          parameter: def.name,
          value,
          unit: def.unit,
          normalizedHeight: def.normalize(sample) * 3.4,
          isAbnormal: isParameterAbnormal(sample, def.name),
        });
      });
    });
    return list;
  }, [displaySamples, stationMap, thresholds]);

  const dataRef = useRef({
    displaySamples,
    pillars,
    colorMode,
    animate,
    selectedIndex,
  });
  dataRef.current = {
    displaySamples,
    pillars,
    colorMode,
    animate,
    selectedIndex,
  };

  const presetGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(...VIEW_PRESETS.iso.pos),
    target: new THREE.Vector3(...VIEW_PRESETS.iso.target),
    active: false,
  });

  const triggerView = (v: ViewPreset) => {
    setViewPreset(v);
    presetGoalRef.current = {
      pos: new THREE.Vector3(...VIEW_PRESETS[v].pos),
      target: new THREE.Vector3(...VIEW_PRESETS[v].target),
      active: true,
    };
  };

  useEffect(() => {
    if (pillars.length > 0 && selectedIndex === null) {
      setSelectedIndex(pillars.length - 1);
    } else if (selectedIndex !== null && selectedIndex >= pillars.length) {
      setSelectedIndex(pillars.length > 0 ? pillars.length - 1 : null);
    }
  }, [pillars.length, selectedIndex]);

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
    const height = container.clientHeight || 340;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061124);
    scene.fog = new THREE.FogExp2(0x061124, 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(...VIEW_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minPolarAngle = 0.15;
    controls.target.set(...VIEW_PRESETS.iso.target);

    const onControlStart = () => {
      presetGoalRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-point studio lighting + cool hemisphere
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x071328, 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(8, 13, 9);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -11;
      keyLight.shadow.camera.right = 11;
      keyLight.shadow.camera.top = 11;
      keyLight.shadow.camera.bottom = -11;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.25);
    rimLight.position.set(-9, 6, -8);
    scene.add(rimLight);

    // Calibrated Coordinate Floor Stage
    const gridTex = createCalibratedGridTexture(
      renderer.capabilities.getMaxAnisotropy()
    );
    const floorMat = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.72,
      metalness: 0.18,
    });
    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.28, 8),
      floorMat
    );
    floorMesh.position.y = -0.14;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const trimRing = new THREE.Mesh(
      new THREE.BoxGeometry(16.2, 0.08, 8.2),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0369a1,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.8,
      })
    );
    trimRing.position.y = -0.25;
    scene.add(trimRing);

    const barsContainer = new THREE.Group();
    scene.add(barsContainer);

    interface BarNode {
      index: number;
      group: THREE.Group;
      columnMesh: THREE.Mesh;
      columnMat: THREE.MeshStandardMaterial;
      capMesh: THREE.Mesh;
      capMat: THREE.MeshStandardMaterial;
      targetHeight: number;
      currentHeight: number;
      paramIndex: number;
      isAbnormal: boolean;
    }

    const barNodes: BarNode[] = [];
    const clickableMeshes: THREE.Object3D[] = [];

    const sharedColumnGeo = new THREE.BoxGeometry(0.54, 1, 0.54);
    const sharedPlinthGeo = new THREE.BoxGeometry(0.64, 0.1, 0.64);
    const sharedCapGeo = new THREE.BoxGeometry(0.58, 0.08, 0.58);
    const sharedPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.78,
      metalness: 0.25,
    });

    const rebuildBars = () => {
      while (barsContainer.children.length > 0) {
        const child = barsContainer.children[0];
        barsContainer.remove(child);
      }
      barNodes.length = 0;
      clickableMeshes.length = 0;

      const { displaySamples: dSamples, pillars: pList } = dataRef.current;
      const sampleCount = dSamples.length;
      if (sampleCount === 0) return;

      const spacingX = Math.min(1.05, 13.5 / Math.max(sampleCount, 1));
      const startX = -((sampleCount - 1) * spacingX) / 2;
      const zOffsets = [-2.1, -0.7, 0.7, 2.1];

      pList.forEach((item, idx) => {
        const sampleIdx = Math.floor(idx / 4);
        const paramIdx = idx % 4;
        const x = startX + sampleIdx * spacingX;
        const z = zOffsets[paramIdx];

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Part 1: Dark Matte Pedestal Base
        const plinth = new THREE.Mesh(sharedPlinthGeo, sharedPlinthMat);
        plinth.position.y = 0.05;
        group.add(plinth);

        // Part 2: Vibrant Data Column
        const colMat = new THREE.MeshStandardMaterial({
          color: PARAM_DEFS[paramIdx].hex,
          emissive: 0x000000,
          emissiveIntensity: 0.2,
          roughness: 0.26,
          metalness: 0.45,
        });
        const columnMesh = new THREE.Mesh(sharedColumnGeo, colMat);
        columnMesh.position.y = 0.1;
        columnMesh.scale.y = 0.05;
        columnMesh.castShadow = !isSoftwareGl;
        columnMesh.userData.pillarIndex = idx;
        group.add(columnMesh);
        clickableMeshes.push(columnMesh);

        // Part 3: Luminous Top Cap
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: PARAM_DEFS[paramIdx].hex,
          emissiveIntensity: 0.8,
          roughness: 0.15,
          metalness: 0.8,
        });
        const capMesh = new THREE.Mesh(sharedCapGeo, capMat);
        capMesh.position.y = 0.14;
        capMesh.userData.pillarIndex = idx;
        group.add(capMesh);
        clickableMeshes.push(capMesh);

        barsContainer.add(group);
        barNodes.push({
          index: idx,
          group,
          columnMesh,
          columnMat: colMat,
          capMesh,
          capMat,
          targetHeight: item.normalizedHeight,
          currentHeight: 0.05,
          paramIndex: paramIdx,
          isAbnormal: item.isAbnormal,
        });
      });
    };

    rebuildBars();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = { x: 0, y: 0 };
    let lastHover = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDown = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (
        Math.hypot(ev.clientX - pointerDown.x, ev.clientY - pointerDown.y) > 6
      )
        return;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.pillarIndex as number | undefined;
        if (typeof idx === 'number') {
          setSelectedIndex(idx);
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHover < 50) return;
      lastHover = now;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

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
    let lastTs = performance.now();
    let lastSignature = dataRef.current.pillars
      .map(
        (p) =>
          `${p.sample.id}:${p.parameter}:${p.value}:${p.isAbnormal ? 1 : 0}`
      )
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
      const dt = Math.min((now - lastTs) / 1000, 0.1);
      lastTs = now;

      const {
        pillars: currentPillars,
        colorMode: mode,
        animate: shouldAnimate,
        selectedIndex: selIdx,
      } = dataRef.current;

      const sig = currentPillars
        .map(
          (p) =>
            `${p.sample.id}:${p.parameter}:${p.value}:${p.isAbnormal ? 1 : 0}`
        )
        .join('|');
      if (sig !== lastSignature) {
        lastSignature = sig;
        rebuildBars();
      }

      if (shouldAnimate) {
        simTime += dt;
      }

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

      for (const node of barNodes) {
        const waveBoost = shouldAnimate
          ? Math.sin(simTime * 2.2 + node.index * 0.35) * 0.04
          : 0;
        const target = Math.max(0.15, node.targetHeight + waveBoost);
        node.currentHeight = shouldAnimate
          ? THREE.MathUtils.damp(node.currentHeight, target, 6.5, dt)
          : target;

        node.columnMesh.scale.y = node.currentHeight;
        node.columnMesh.position.y = 0.1 + node.currentHeight / 2;
        node.capMesh.position.y = 0.1 + node.currentHeight + 0.04;

        const isSelected = node.index === selIdx;
        const spectrumHex = PARAM_DEFS[node.paramIndex].hex;

        if (mode === 'status') {
          const hex = node.isAbnormal ? 0xf43f5e : 0x10b981;
          node.columnMat.color.setHex(hex);
          node.columnMat.emissive.setHex(hex);
          node.columnMat.emissiveIntensity = isSelected
            ? 0.55
            : node.isAbnormal
            ? 0.32
            : 0.12;
          node.capMat.emissive.setHex(hex);
        } else {
          const hex = node.isAbnormal ? 0xf43f5e : spectrumHex;
          node.columnMat.color.setHex(hex);
          node.columnMat.emissive.setHex(hex);
          node.columnMat.emissiveIntensity = isSelected
            ? 0.58
            : node.isAbnormal
            ? 0.35
            : 0.14;
          node.capMat.emissive.setHex(hex);
        }
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
      sharedColumnGeo.dispose();
      sharedPlinthGeo.dispose();
      sharedCapGeo.dispose();
      sharedPlinthMat.dispose();
      envTexture.dispose();
      disposeSceneResources(scene);
      renderer.dispose();
    };
  }, []);

  const selectedPillar =
    selectedIndex !== null ? pillars[selectedIndex] ?? null : null;

  return (
    <div className="bg-[#061124] border border-slate-800 rounded-2xl overflow-hidden shadow-lg text-white">
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#081730]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-sky-500 to-indigo-500 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-tight">
              3D Multi-Parameter Water Quality Matrix
            </h3>
            <p className="text-[11px] text-cyan-200/80">
              Latest {displaySamples.length} filtered samples across pH, Turbidity, Dissolved Oxygen & Temperature · Click any 3D column to inspect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setColorMode('spectrum')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                colorMode === 'spectrum'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Parameter Spectrum
            </button>
            <button
              type="button"
              onClick={() => setColorMode('status')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                colorMode === 'status'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Threshold Status
            </button>
          </div>

          <div className="flex items-center gap-1">
            {(['iso', 'front', 'side'] as ViewPreset[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => triggerView(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                  viewPreset === v
                    ? 'bg-indigo-500 text-white font-semibold'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {v === 'iso' ? 'Isometric' : v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => triggerView('iso')}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Reset 3D view"
              aria-label="Reset 3D view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Stage */}
      <div className="relative h-[340px] w-full">
        {webglError ? (
          <div className="h-full w-full flex items-center justify-center p-6 text-center text-xs text-slate-300">
            3D WebGL Matrix unavailable in this browser context. Inspect the 2D interactive charts below.
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        {/* Color Legend Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none bg-[#071326]/90 border border-slate-700/80 rounded-lg px-3 py-2 text-[11px] flex flex-wrap gap-x-3.5 gap-y-1">
          {colorMode === 'spectrum' ? (
            <>
              {PARAM_DEFS.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-slate-200">
                  <span className={`w-2.5 h-2.5 rounded-sm ${d.css}`} />
                  {d.name}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Threshold Breach
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Within Configured Thresholds
              </span>
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Outside Configured Thresholds
              </span>
            </>
          )}
        </div>

        {/* Selected Bar Telemetry Bar */}
        {selectedPillar && (
          <div className="absolute bottom-3 left-3 right-3 z-10 bg-[#071326]/92 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono font-bold text-cyan-300">
                {selectedPillar.sample.id}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-medium text-white">
                {selectedPillar.stationName}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-sky-300 font-semibold">
                {selectedPillar.parameter}:{' '}
                <span className="font-mono text-white">
                  {selectedPillar.value} {selectedPillar.unit}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-semibold ${
                  selectedPillar.isAbnormal
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedPillar.isAbnormal
                  ? 'Outside Configured Thresholds'
                  : 'Within Configured Thresholds'}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {formatDateTime(selectedPillar.sample.collectionDate)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
