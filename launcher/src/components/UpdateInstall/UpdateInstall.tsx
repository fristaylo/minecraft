import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';
import { useState } from 'react';
import { errorText, installUpdate, type UpdateProgress } from '@/api';
import { useToast } from '@/context/Toast';
import { formatSize } from '@/format';
import s from './UpdateInstall.module.scss';

export function UpdateInstall({ onLater }: { onLater?: () => void }) {
  const toast = useToast();
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  async function install() {
    setProgress({ done: 0, total: null });
    const unlisten = await listen<UpdateProgress>('updater://progress', ({ payload }) => setProgress(payload));
    try {
      await installUpdate();
      await relaunch();
    } catch (error) {
      setProgress(null);
      toast('Не удалось обновить лаунчер', errorText(error), { kind: 'warn' });
    } finally {
      unlisten();
    }
  }

  if (progress) {
    return (
      <div className={s.progress}>
        <div className="pbar">
          <i style={{ width: progress.total ? `${Math.min(100, (progress.done / progress.total) * 100)}%` : '0' }} />
        </div>
        <span className="hint pct">
          {progress.total ? `Скачивание · ${formatSize(progress.done)} из ${formatSize(progress.total)}` : 'Скачивание'}
        </span>
      </div>
    );
  }

  return (
    <div className={s.actions}>
      <button className="btn sm primary" type="button" onClick={() => void install()}>
        Обновить и перезапустить
      </button>
      {onLater && (
        <button className="btn sm ghost" type="button" onClick={onLater}>
          Позже
        </button>
      )}
    </div>
  );
}
