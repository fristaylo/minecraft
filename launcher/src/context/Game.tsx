import { listen } from '@tauri-apps/api/event';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  cancelLaunch,
  errorText,
  listPacks,
  localPackState,
  packManifest,
  play as apiPlay,
  serverStatus,
  setOptional,
  stopGame,
  type LaunchProgress,
  type LocalPackState,
  type Manifest,
  type Pack,
  type ServerStatus,
} from '@/api';
import { formatSize } from '@/format';
import { useSession } from './Session';
import { useToast } from './Toast';

export type PackInfo = { pack: Pack; manifest: Manifest; local: LocalPackState };
export type Run = { packId: Pack['id']; step: number; pct: number; label: string; detail: string };
type Running = { packId: Pack['id']; since: number };

type Game = {
  packs: PackInfo[] | null;
  loadError: string | null;
  reload: () => Promise<void>;
  selected: PackInfo | undefined;
  select: (packId: Pack['id']) => void;
  toggleOptional: (packId: Pack['id'], path: string, enabled: boolean) => Promise<void>;
  status: ServerStatus | null;
  run: Run | null;
  running: Running | null;
  play: (packId: Pack['id']) => Promise<void>;
  cancel: () => void;
  stop: () => void;
};

export const STEPS = ['Сборка', 'Версия', 'Java', 'Файлы', 'Запуск'];

const STAGES: Record<string, { step: number; label: string }> = {
  sync: { step: 0, label: 'Файлы сборки' },
  version: { step: 1, label: 'Версия игры' },
  loader: { step: 1, label: 'Загрузчик' },
  java: { step: 2, label: 'Java' },
  libraries: { step: 3, label: 'Библиотеки' },
  client: { step: 3, label: 'Клиент игры' },
  assets: { step: 3, label: 'Ресурсы' },
  authlib: { step: 4, label: 'Авторизация' },
  game: { step: 4, label: 'Открываем Minecraft…' },
};

const GameContext = createContext<Game | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const accountId = useSession().account?.id;
  const [packs, setPacks] = useState<PackInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('pack'));
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const playing = useRef<{ packId: Pack['id']; canceled: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listPacks();
      setPacks(
        await Promise.all(
          list.map(async (pack) => {
            const [manifest, local] = await Promise.all([packManifest(pack.id), localPackState(pack.id)]);
            return { pack, manifest, local };
          }),
        ),
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, []);

  useEffect(() => {
    if (accountId) void load();
  }, [accountId, load]);

  useEffect(() => {
    const refresh = () => serverStatus().then(setStatus, () => setStatus(null));
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscriptions = [
      listen<LaunchProgress>('launch://progress', ({ payload }) =>
        setRun((current) => current && advance(current, payload)),
      ),
      listen('game://started', () =>
        setRunning(playing.current && { packId: playing.current.packId, since: Date.now() }),
      ),
      listen('game://exited', () => setRunning(null)),
    ];
    return () => subscriptions.forEach((subscription) => void subscription.then((unlisten) => unlisten()));
  }, []);

  const value = useMemo<Game>(
    () => ({
      packs,
      loadError,
      reload: load,
      selected: packs?.find(({ pack }) => pack.id === selectedId) ?? packs?.[0],
      select(packId) {
        localStorage.setItem('pack', packId);
        setSelectedId(packId);
      },
      async toggleOptional(packId, path, enabled) {
        try {
          await setOptional({ packId, path, enabled });
          const local = await localPackState(packId);
          setPacks((list) => list && list.map((info) => (info.pack.id === packId ? { ...info, local } : info)));
        } catch (error) {
          toast('Не удалось сохранить выбор', errorText(error), { kind: 'warn' });
        }
      },
      status,
      run,
      running,
      async play(packId) {
        playing.current = { packId, canceled: false };
        setRun({ packId, step: 0, pct: 0, label: 'Подготовка', detail: '' });
        try {
          await apiPlay(packId);
        } catch (error) {
          if (playing.current.canceled) {
            toast('Запуск отменён', 'Скачанные файлы сохранены, продолжим с того же места.', { kind: 'info' });
          } else {
            toast('Не удалось запустить игру', errorText(error), { kind: 'warn' });
          }
        }
        setRun(null);
        void load();
      },
      cancel() {
        if (playing.current) playing.current.canceled = true;
        void cancelLaunch();
      },
      stop() {
        void stopGame();
      },
    }),
    [packs, loadError, selectedId, status, run, running, load, toast],
  );

  return <GameContext value={value}>{children}</GameContext>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('GameProvider is missing');
  return value;
}

function advance(run: Run, event: LaunchProgress): Run {
  const stage = STAGES[event.stage] ?? { step: run.step, label: event.label };
  const fraction = event.bytes_total > 0 ? event.bytes_done / event.bytes_total : event.total > 0 ? event.done / event.total : 0;
  const detail = [
    event.total > 1 ? `${event.done} из ${event.total}` : '',
    event.bytes_total > 0 ? `${formatSize(event.bytes_done)} из ${formatSize(event.bytes_total)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    packId: run.packId,
    step: Math.max(run.step, stage.step),
    pct: Math.max(run.pct, ((stage.step + Math.min(1, fraction)) / STEPS.length) * 100),
    label: stage.label,
    detail,
  };
}

export function packStatus({ local }: PackInfo): 'new' | 'update' | 'ready' {
  if (local.installed_version === null) return 'new';
  return local.update_bytes > 0 ? 'update' : 'ready';
}

export function modCount({ manifest }: PackInfo): number {
  return manifest.files.filter((file) => file.kind === 'mod' && file.side !== 'server').length;
}
