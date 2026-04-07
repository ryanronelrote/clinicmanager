import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/settingsService';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsService.getAll();
      setSettings(data);
      document.documentElement.setAttribute('data-theme', data.app_theme || 'default');
    } catch {
      // fallback to defaults
    }
  }, []);

  async function updateSettings(patch) {
    const data = await settingsService.save(patch);
    setSettings(data);
    if (patch.app_theme) {
      document.documentElement.setAttribute('data-theme', patch.app_theme);
    }
    return data;
  }

  return (
    <SettingsContext.Provider value={{ settings, loadSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useClinicSettings() {
  return useContext(SettingsContext);
}
