import { listen } from '@tauri-apps/api/event';
import { useState } from 'react';
import { Icon } from '@components/Icon/Icon';
import { publish, type AdminPack, type Manifest } from '@/api';
import { useToast } from '@/context/Toast';
import { useAttempt } from './attempt';
import s from './Admin.module.scss';

type PublishEvent = { stage: 'check' | 'upload' | 'publish' | 'done'; label: string; done: number; total: number };
type Progress = { label: string; pct: number; detail: string };

export function PublishBar({
  pack,
  draft,
  changes,
  onPublished,
  onSettled,
}: {
  pack: Pick<AdminPack, 'id' | 'gameServer'>;
  draft: Pick<Manifest, 'version'>;
  changes: number;
  onPublished: (version: string) => void;
  onSettled: () => Promise<void>;
}) {
  const toast = useToast();
  const attempt = useAttempt();
  const [typed, setTyped] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const version = typed ?? bump(draft.version);

  async function run() {
    setProgress({ label: 'Подготовка', pct: 0, detail: '' });
    const unlisten = await listen<PublishEvent>('admin://publish', ({ payload }) => setProgress(describe(payload, pack.gameServer)));
    await attempt(async () => {
      const published = await publish({ packId: pack.id, version, notes });
      published.warnings.forEach((warning) => toast('Предупреждение сервера', warning, { kind: 'warn' }));
      toast(`Сборка ${published.version} опубликована`, 'Игроки получат обновление при запуске.');
      setNotes('');
      setTyped(null);
      onPublished(published.version);
    });
    await attempt(onSettled);
    unlisten();
    setProgress(null);
  }

  if (progress) {
    return (
      <div className={s.pubbar}>
        <div className={s.pubLeft}>
          <div className={s.progTop}>
            <b>{progress.label}</b>
            <span className="pct">{Math.round(progress.pct)}%</span>
          </div>
          <div className="pbar">
            <i style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="hint pct">{progress.detail}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.pubbar}>
      <div className={s.pubLeft}>
        <b>{changes ? `${changes} ${changesWord(changes)} не опубликовано` : 'Изменений нет'}</b>
        <span className="hint">
          {changes
            ? `Выйдет как ${version}. ${pack.gameServer ? 'Игровой сервер перезапустится с новой сборкой.' : ''}`
            : draft.version
              ? `Опубликована версия ${draft.version}`
              : 'Сборка ещё не опубликована'}
        </span>
        {changes > 0 && (
          <div className={s.pubFields}>
            <label className="fld">
              <span>Версия</span>
              <input className={`inp ${s.mono}`} value={version} onChange={(event) => setTyped(event.target.value)} />
            </label>
            <label className="fld">
              <span>Заметки к версии</span>
              <textarea
                className="inp"
                rows={2}
                placeholder="Каждая строка станет отдельным пунктом «Что нового»"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
        )}
      </div>
      <button className="btn primary" type="button" disabled={!changes || !/^[\w.+-]{1,32}$/.test(version)} onClick={() => void run()}>
        <Icon name="upload" size={18} stroke={2.2} />
        Опубликовать
      </button>
    </div>
  );
}

function describe({ stage, label, done, total }: PublishEvent, gameServer: boolean): Progress {
  if (stage === 'check') return { label: 'Проверка файлов', pct: 2, detail: '' };
  if (stage === 'upload') {
    return {
      label: 'Загрузка файлов на сервер',
      pct: 5 + (total ? (done / total) * 80 : 0),
      detail: `${done} из ${total} файлов · ${label}`,
    };
  }
  if (stage === 'publish') return { label: 'Публикация версии', pct: 90, detail: gameServer ? 'обновление игрового сервера' : '' };
  return { label: 'Готово', pct: 100, detail: '' };
}

function bump(version: string): string {
  const parts = version.split('.');
  const last = Number(parts.at(-1));
  return version && Number.isInteger(last) ? [...parts.slice(0, -1), last + 1].join('.') : version || '1.0.0';
}

function changesWord(count: number): string {
  const rest = count % 10;
  if (rest === 1 && count % 100 !== 11) return 'изменение';
  return rest >= 2 && rest <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'изменения' : 'изменений';
}
