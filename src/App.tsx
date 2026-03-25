import { useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Finances from './pages/Finances';
import Files from './pages/Files';
import Onboarding from './pages/Onboarding';
import Paywall from './components/Paywall';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';


export default function App() {
  const { user, loading } = useAuth();
  const { isActive, loading: subLoading, celebratingPayment } = useSubscription();
  const navigate = useNavigate();
  const wasPaywalled = useRef(false);

  const showPaywall = Boolean(user && user.onboarding_complete && (!isActive || celebratingPayment));

  useEffect(() => {
    if (showPaywall) {
      wasPaywalled.current = true;
    } else if (wasPaywalled.current) {
      wasPaywalled.current = false;
      navigate('/', { replace: true });
    }
  }, [showPaywall, navigate]);

  if (loading || (user && subLoading)) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !user.onboarding_complete) {
    return <Onboarding />;
  }

  if (showPaywall) {
    return <Paywall />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/files" element={<Files />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
