import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorText, getSettings, saveSettings, systemMemory, type Settings } from '@/api';
import { useToast } from './Toast';

type Value = {
  settings: Settings;
  memory: number;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<Value | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>();
  const [memory, setMemory] = useState(0);

  useEffect(() => {
    Promise.all([getSettings(), systemMemory()]).then(([loaded, total]) => {
      setSettings(loaded);
      setMemory(total);
    });
  }, []);

  const value = useMemo<Value | null>(
    () =>
      settings
        ? {
            settings,
            memory,
            update(patch) {
              const next = { ...settings, ...patch };
              setSettings(next);
              saveSettings(next).catch((error: unknown) => toast('Не удалось сохранить настройки', errorText(error), { kind: 'warn' }));
            },
          }
        : null,
    [settings, memory, toast],
  );

  return value && <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('SettingsProvider is missing');
  return value;
}
