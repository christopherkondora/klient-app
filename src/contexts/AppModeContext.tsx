import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type AppMode = 'klient' | 'ads';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggle: () => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: 'klient',
  setMode: () => {},
  toggle: () => {},
});

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<AppMode>('klient');
  const navigate = useNavigate();
  const lastKlientPath = useRef('/');
  const lastAdsPath = useRef('/ads/overview');

  const setMode = useCallback((newMode: AppMode) => {
    // Save current position synchronously before navigating
    const currentPath = window.location.hash.replace('#', '') || '/';
    setModeRaw(prev => {
      if (prev === 'klient') lastKlientPath.current = currentPath;
      else lastAdsPath.current = currentPath;
      return newMode;
    });
    // Navigate to saved position
    if (newMode === 'ads') {
      navigate(lastAdsPath.current, { replace: true });
    } else {
      navigate(lastKlientPath.current, { replace: true });
    }
  }, [navigate]);

  const toggle = useCallback(() => {
    setMode(mode === 'klient' ? 'ads' : 'klient');
  }, [mode, setMode]);

  return (
    <AppModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
