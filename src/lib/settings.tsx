import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Settings } from '@/lib/types';
import { fetchSettings, upsertSettings } from '@/lib/api';

interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  saveSettings: (s: Pick<Settings, 'business_name' | 'currency' | 'tax_rate'>) => Promise<void>;
  refresh: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (err) {
      console.error('Settings load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (s: Pick<Settings, 'business_name' | 'currency' | 'tax_rate'>) => {
    const updated = await upsertSettings(s);
    setSettings(updated);
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, saveSettings, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
