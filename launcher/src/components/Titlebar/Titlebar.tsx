import type { Pack, ServerStatus } from '@/api';
import { Blocks } from '@components/Loaders/Loaders';
import { useGame } from '@/context/Game';
import { isMac } from '@/format';
import { WindowButtons } from './WindowButtons';
import s from './Titlebar.module.scss';

export function Titlebar() {
  const { packs, selected, status, run, running } = useGame();
  const nameOf = (packId: string) => packs?.find(({ pack }) => pack.id === packId)?.pack.name;

  return (
    <div className={`${s.titlebar} ${isMac ? s.mac : ''}`} data-tauri-drag-region>
      <div className={s.status}>
        {run ? (
          <>
            <Blocks />
            <span>
              <b className={s.strong}>{nameOf(run.packId)}</b> · {run.label}
            </span>
            <span className={s.bar}>
              <i style={{ width: `${run.pct}%` }} />
            </span>
            <span className="pct">{Math.round(run.pct)}%</span>
          </>
        ) : running ? (
          <>
            <span className="ldot" />
            <span>Игра запущена · {nameOf(running.packId)}</span>
          </>
        ) : selected ? (
          <>
            <span className={`ldot ${selected.pack.server && status?.online ? '' : 'off'}`} />
            <span>{statusLine(selected.pack, status)}</span>
          </>
        ) : null}
      </div>
      <WindowButtons />
    </div>
  );
}

export function FloatingTitlebar() {
  return (
    <div className={s.floating} data-tauri-drag-region>
      <WindowButtons />
    </div>
  );
}

function statusLine({ name, server }: Pick<Pack, 'name' | 'server'>, status: ServerStatus | null) {
  if (!server) return `${name} · одиночная игра или любой сервер`;
  if (!status?.online) return `${server} · сервер недоступен`;
  return `${server} · ${status.players.online} из ${status.players.max} онлайн${status.ping === null ? '' : ` · ${status.ping} мс`}`;
}
