import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Layout } from './components/Layout';
import { useWqms, WqmsProvider } from './context/WqmsContext';
import { AddSamplePage } from './pages/AddSamplePage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StationsPage } from './pages/StationsPage';
import { WaterSamplesPage } from './pages/WaterSamplesPage';

function ActivePageView() {
  const { activePage } = useWqms();

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'samples':
        return <WaterSamplesPage />;
      case 'add-sample':
        return <AddSamplePage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'stations':
        return <StationsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activePage}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderPage()}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <WqmsProvider>
        <Layout>
          <ActivePageView />
        </Layout>
      </WqmsProvider>
    </MotionConfig>
  );
}
