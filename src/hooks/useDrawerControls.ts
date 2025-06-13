import { useState, useCallback } from 'react';

interface DrawerControls {
  isHistoryDrawerOpen: boolean;
  isSettingsDrawerOpen: boolean;
  
  openHistoryDrawer: () => void;
  closeHistoryDrawer: () => void;
  
  openSettingsDrawer: () => void;
  closeSettingsDrawer: () => void;
  
  openSettingsDirectly: () => void; // For avatar button
  closeAllDrawers: () => void;
}

export const useDrawerControls = (): DrawerControls => {
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  const openHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen(true);
    setIsSettingsDrawerOpen(false);
  }, []);

  const closeHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen(false);
    setIsSettingsDrawerOpen(false);
  }, []);

  const openSettingsDrawer = useCallback(() => {
    // Settings drawer opens over history drawer
    setIsSettingsDrawerOpen(true);
  }, []);

  const closeSettingsDrawer = useCallback(() => {
    setIsSettingsDrawerOpen(false);
  }, []);

  const openSettingsDirectly = useCallback(() => {
    // For avatar button - opens settings directly
    setIsHistoryDrawerOpen(true);
    setIsSettingsDrawerOpen(true);
  }, []);

  const closeAllDrawers = useCallback(() => {
    setIsHistoryDrawerOpen(false);
    setIsSettingsDrawerOpen(false);
  }, []);

  return {
    isHistoryDrawerOpen,
    isSettingsDrawerOpen,
    openHistoryDrawer,
    closeHistoryDrawer,
    openSettingsDrawer,
    closeSettingsDrawer,
    openSettingsDirectly,
    closeAllDrawers,
  };
}; 