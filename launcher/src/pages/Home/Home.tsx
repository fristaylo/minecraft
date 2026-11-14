import { ask } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blocks } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { Scene } from '@components/Scene/Scene';
import { errorText, resetConfigs } from '@/api';
import { modCount, packStatus, STEPS, useGame, type PackInfo } from '@/context/Game';
import { useAccount } from '@/context/Session';
import { useSettings } from '@/context/Settings';
import { useToast } from '@/context/Toast';
import { formatLoader, formatSize, instanceDir, modsWord } from '@/format';
import s from './Home.module.scss';

export function Home() {
  const { packs, selected, loadError, reload, status, run, running, play, cancel, stop } = useGame();
  const account = useAccount();
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const toast = useToast();

  if (!packs || !selected) {
    return (
      <div className={s.empty}>
        {loadError ? (
          <>
            <b>Не удалось загрузить сборки</b>
            <span>{loadError}</span>
            <button className="btn" type="button" onClick={() => void reload()}>
              <Icon name="refresh" size={16} />
              Повторить
            </button>
          </>
        ) : packs ? (
          <>
            <b>Сборок пока нет</b>
            <span>Админ сервера ещё ничего не опубликовал.</span>
          </>
        ) : (
          <Blocks />
        )}
      </div>
    );
  }

  const { pack, manifest, local } = selected;
  const { server } = pack;
  const pendingRole = account.role === 'pending';
  const busy = run !== null || running !== null;
  const code = packStatus(selected);
  const mods = modCount(selected);

  return (
    <>
      <section className={s.hero}>
        <Scene className={s.heroCanvas} theme={pack.theme} seed={pack.id} width={330} height={112} animated />
        <div className={s.heroBody}>
          {pendingRole ? (
            <span className="badge warn">
              <Icon name="clock" size={13} stroke={2.2} />
              Заявка на рассмотрении
            </span>
          ) : (
            <StatusBadge info={selected} />
          )}
          <h1 className={s.title}>{pack.name}</h1>
          <div className={s.meta}>
            <span>
              <Icon name="cube" size={16} />
              Minecraft {pack.minecraft}
            </span>
            <span>
              <Icon name="layers" size={16} />
              {formatLoader(pack.loader)}
            </span>
            <span>
              <Icon name="box" size={16} />
              {mods ? modsWord(mods) : 'без модов'}
            </span>
            <span>
              <Icon name="disk" size={16} />
              {formatSize(pack.size)}
            </span>
          </div>
          <div className={s.actions}>{actions()}</div>
        </div>
        {server && (
          <div className={s.server}>
            <div className={s.addr}>
              <span>{server}</span>
              <button className="btn ghost icon sm" type="button" aria-label="Скопировать адрес" onClick={() => void copyAddress(server)}>
                <Icon name="copy" size={15} />
              </button>
            </div>
            <div className={s.row2}>
              <div>
                {status?.online ? (
                  <>
                    <b className={s.count}>{status.players.online}</b> <span className="hint">из {status.players.max} онлайн</span>
                  </>
                ) : (
                  <span className="hint">Сервер недоступен</span>
                )}
              </div>
              <div className={s.faces}>
                {status?.players.sample.slice(0, 4).map((name) => (
                  <span key={name} title={name}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className={s.addr}>
              <span>
                <Icon name="signal" size={14} /> {status?.ping != null ? `${status.ping} мс` : '—'}
              </span>
            </div>
          </div>
        )}
      </section>
      {packs.length > 1 && (
        <>
          <div className={s.secHead}>
            <h2>
              Сборки <span className="cnt">{packs.length}</span>
            </h2>
            <span className="hint">Сборки публикует админ сервера, обновления скачиваются сами.</span>
          </div>
          <div className={s.grid}>
            {packs.map((info) => (
              <PackCard key={info.pack.id} info={info} current={info.pack.id === pack.id} disabled={busy || pendingRole} />
            ))}
          </div>
        </>
      )}
      <div className={s.cols} style={packs.length > 1 ? undefined : { marginTop: 16 }}>
        <div className="panel">
          <div className="ph">
            <h3>Что нового в {manifest.version}</h3>
            {code === 'update' && <span className="tag warn">у вас {local.installed_version}</span>}
          </div>
          {manifest.changelog.length ? (
            <ul className={s.log}>
              {manifest.changelog.map(({ kind, text }, i) => (
                <li key={i}>
                  <span className={`badge sm ${CHANGE[kind].tone}`}>{CHANGE[kind].label}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Список изменений пока пуст.</p>
          )}
        </div>
        <div className="panel">
          <h3>О сборке</h3>
          <div className={s.stats}>
            <Stat value={local.installed_version ?? '—'} label="установленная версия" />
            <Stat value={mods ? modsWord(mods) : '—'} label="в сборке" />
            <Stat value={`${settings.ram_gb} ГБ`.replace('.', ',')} label="памяти игре" />
            <Stat value={manifest.java ? `Java ${manifest.java}` : 'Java'} label="скачивается сама" />
          </div>
        </div>
      </div>
    </>
  );

  function actions() {
    if (run?.packId === pack.id) {
      return (
        <>
          <div className={s.prog}>
            <div className={s.progTop}>
              <b>{run.label}</b>
              <span className="pct">{Math.round(run.pct)}%</span>
            </div>
            <div className="pbar">
              <i style={{ width: `${run.pct}%` }} />
            </div>
            <div className={s.detail}>
              <span>{run.detail}</span>
            </div>
            <div className={s.steps}>
              {STEPS.map((step, i) => (
                <span key={step} className={`${s.step} ${i < run.step ? s.done : i === run.step ? s.now : ''}`}>
                  {i < run.step && <Icon name="check" size={12} stroke={2.6} />}
                  {step}
                </span>
              ))}
            </div>
          </div>
          <button className="btn over lg" type="button" disabled={run.step === STEPS.length - 1} onClick={cancel}>
            Отмена
          </button>
        </>
      );
    }
    if (running?.packId === pack.id) {
      return (
        <>
          <span className={`badge ok ${s.runBadge}`}>
            <span className="ldot" />
            Игра запущена · <RunTimer since={running.since} />
          </span>
          <button className="btn danger lg" type="button" onClick={stop}>
            Закрыть игру
          </button>
        </>
      );
    }
    if (pendingRole) {
      return (
        <>
          <button className={`btn primary lg ${s.play}`} type="button" disabled>
            <Icon name="lock" size={20} />
            Ждём одобрения
          </button>
          <span className={`hint ${s.note}`}>Заявка у админа. После одобрения вы попадёте в whitelist сервера и сможете играть.</span>
        </>
      );
    }
    return (
      <>
        {server && (
          <label className={`check ${s.autoJoin}`}>
            <input type="checkbox" className="sw" checked={settings.auto_join} onChange={(event) => update({ auto_join: event.target.checked })} /> Сразу на сервер
          </label>
        )}
        <button className={`btn primary lg ${s.play}`} type="button" disabled={busy} onClick={() => void play(pack.id)}>
          <Icon name={code === 'ready' ? 'play' : 'download'} size={20} stroke={2.2} />
          {PLAY_LABEL[code]}
        </button>
        {mods > 0 && (
          <button className="btn over lg" type="button" onClick={() => navigate('/mods')}>
            <Icon name="cube" size={18} />
            Моды
          </button>
        )}
        <button className="btn over icon lg" type="button" aria-label="Открыть папку сборки" onClick={() => void openFolder()}>
          <Icon name="folder" size={20} />
        </button>
        <button className="btn over icon lg" type="button" aria-label="Сбросить настройки" title="Сбросить настройки" disabled={busy} onClick={() => void resetPackConfigs()}>
          <Icon name="refresh" size={20} />
        </button>
        {busy && <span className={`hint ${s.note}`}>Сначала дождитесь запуска другой сборки</span>}
      </>
    );
  }

  async function openFolder() {
    try {
      await openPath(instanceDir(settings.game_dir, pack.id));
    } catch (error) {
      toast('Не удалось открыть папку', errorText(error), { kind: 'warn' });
    }
  }

  async function resetPackConfigs() {
    const confirmed = await ask('Сбросить настройки и клавиши к настройкам сборки? Они восстановятся при следующем запуске.', {
      title: 'Сброс настроек',
      kind: 'warning',
      okLabel: 'Сбросить',
      cancelLabel: 'Отмена',
    });
    if (!confirmed) return;
    try {
      await resetConfigs(pack.id);
      toast('Настройки сброшены', 'Восстановятся при запуске');
    } catch (error) {
      toast('Не удалось сбросить настройки', errorText(error), { kind: 'warn' });
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    toast('Адрес скопирован', address);
  }
}

function PackCard({ info, current, disabled }: { info: PackInfo; current: boolean; disabled: boolean }) {
  const { select, play } = useGame();
  const code = packStatus(info);
  const count = modCount(info);
  const scrollTop = (button: HTMLElement) => button.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <article className={s.card} aria-current={current}>
      <button
        className={s.cardSelect}
        type="button"
        aria-label={`Выбрать сборку ${info.pack.name}`}
        onClick={(event) => {
          select(info.pack.id);
          scrollTop(event.currentTarget);
        }}
      />
      <div className={s.cover}>
        <Scene className={s.coverCanvas} theme={info.pack.theme} seed={`${info.pack.id}c`} width={160} height={90} />
        {code !== 'ready' && <StatusBadge info={info} small />}
      </div>
      <div className={s.cardBody}>
        <div className={s.cardTitle}>{info.pack.name}</div>
        <div className={s.cardMeta}>
          {info.pack.minecraft} · {formatLoader(info.pack.loader)} · {count ? modsWord(count) : 'без модов'}
        </div>
        <div className={s.cardFoot}>
          <span className="hint">Версия {info.pack.version}</span>
          <button
            className={`btn icon ${code === 'ready' ? 'primary' : ''}`}
            type="button"
            aria-label={`Играть в ${info.pack.name}`}
            disabled={disabled}
            onClick={(event) => {
              select(info.pack.id);
              void play(info.pack.id);
              scrollTop(event.currentTarget);
            }}
          >
            <Icon name={code === 'ready' ? 'play' : 'download'} size={18} stroke={2.2} />
          </button>
        </div>
      </div>
    </article>
  );
}

const PLAY_LABEL = { ready: 'Играть', update: 'Обновить', new: 'Установить' };

const CHANGE = {
  add: { label: 'Добавлено', tone: 'ok' },
  upd: { label: 'Обновлено', tone: 'info' },
  del: { label: 'Убрано', tone: 'bad' },
};

function StatusBadge({ info, small }: { info: PackInfo; small?: boolean }) {
  const code = packStatus(info);
  const size = small ? 'sm' : '';
  if (code === 'update') {
    return (
      <span className={`badge warn ${size}`}>
        <Icon name="download" size={13} stroke={2.2} />
        Обновление {formatSize(info.local.update_bytes)}
      </span>
    );
  }
  return code === 'ready' ? (
    <span className={`badge ok ${size}`}>
      <Icon name="check" size={13} stroke={2.4} />
      Готова
    </span>
  ) : (
    <span className={`badge ${size}`}>
      <Icon name="download" size={13} stroke={2.2} />
      Не скачана
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={s.stat}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function RunTimer({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.floor((now - since) / 1000);
  return <span className="pct">{`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}</span>;
}
