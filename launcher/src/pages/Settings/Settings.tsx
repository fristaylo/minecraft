import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { useEffect, useState, type ChangeEvent, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { UpdateInstall } from '@components/UpdateInstall/UpdateInstall';
import { checkUpdate, errorText, type Settings as SettingsData } from '@/api';
import { modCount, useGame } from '@/context/Game';
import { isMac } from '@/format';
import { useSettings } from '@/context/Settings';
import { useToast } from '@/context/Toast';
import s from './Settings.module.scss';

const SYSTEM_GB = 4;

export function Settings() {
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Настройки</h1>
          <p>Применяются ко всем сборкам и сохраняются сразу.</p>
        </div>
      </div>
      <div className={s.sets}>
        <Section id="game" title="Игра" icon="monitor">
          <Memory />
          <GameWindow />
        </Section>
        <Section id="java" title="Java" icon="coffee">
          <Java />
        </Section>
        <Section id="launcher" title="Лаунчер" icon="gear">
          <Behaviour />
          <Files />
        </Section>
        <Section id="about" title="О лаунчере" icon="info">
          <About />
        </Section>
      </div>
    </>
  );
}

function Memory() {
  const { settings, memory, update } = useSettings();
  const { selected } = useGame();
  const max = Math.max(2, Math.floor(memory));
  const gb = settings.ram_gb;

  return (
    <div className="panel">
      <h3>Память</h3>
      <p className={`hint ${s.lead}`}>
        {selected && `Для «${selected.pack.name}» рекомендуем ${modCount(selected) > 12 ? '6–8' : '3–4'} ГБ. `}В компьютере {Math.round(memory)} ГБ.
      </p>
      <div className={s.ram}>
        <div className={s.ramValue}>
          {formatGb(gb)}
          <small>ГБ</small>
        </div>
        <div className={s.ramRange}>
          <input
            type="range"
            min={1}
            max={max}
            step={0.5}
            value={gb}
            style={pctStyle(gb, 1, max)}
            aria-label="Память для игры"
            onChange={(event) => update({ ram_gb: Number(event.target.value) })}
          />
        </div>
      </div>
      <div className={s.membar} aria-hidden="true">
        <i className={s.sys} style={{ width: `${(SYSTEM_GB / max) * 100}%` }} />
        <i className={s.mc} style={{ width: `${(gb / max) * 100}%` }} />
      </div>
      <div className={s.legend}>
        <span>
          <i className={s.sys} />
          Windows и программы ≈ {SYSTEM_GB} ГБ
        </span>
        <span>
          <i className={s.mc} />
          Игра
        </span>
        <span>
          <i className={s.free} />
          Свободно
        </span>
        {gb > max - SYSTEM_GB && <span className={s.warn}>Оставьте системе хотя бы {SYSTEM_GB} ГБ</span>}
      </div>
    </div>
  );
}

function GameWindow() {
  const { settings, update } = useSettings();
  const win = settings.window;
  const full = win.mode === 'fullscreen';
  const patch = (next: Partial<SettingsData['window']>) => update({ window: { ...win, ...next } });
  const commit = (key: 'width' | 'height') => (value: string) => {
    const size = Math.max(640, Math.min(7680, parseInt(value, 10) || win[key]));
    patch(key === 'width' ? { width: size } : { height: size });
  };
  const width = useDraft(String(win.width), commit('width'));
  const height = useDraft(String(win.height), commit('height'));

  return (
    <div className="panel">
      <h3>Окно игры</h3>
      <Row title="Режим" hint="Полный экран берёт разрешение монитора">
        <div className="pills" role="group" aria-label="Режим окна">
          <button type="button" aria-pressed={!full} onClick={() => patch({ mode: 'window' })}>
            Оконный
          </button>
          <button type="button" aria-pressed={full} onClick={() => patch({ mode: 'fullscreen' })}>
            Полный экран
          </button>
        </div>
      </Row>
      <Row title="Разрешение" hint="Ширина и высота окна">
        <div className={s.res}>
          <input className="inp" inputMode="numeric" aria-label="Ширина" disabled={full} {...width} />
          <span className="hint">×</span>
          <input className="inp" inputMode="numeric" aria-label="Высота" disabled={full} {...height} />
          {RESOLUTIONS.map(([width, height]) => (
            <button key={width} className="btn sm" type="button" disabled={full} onClick={() => patch({ width, height })}>
              {width}×{height}
            </button>
          ))}
        </div>
      </Row>
      <Row title="Открывать развёрнутым" hint="Окно сразу на весь экран, с рамкой">
        <input
          type="checkbox"
          className="sw"
          checked={win.maximized}
          disabled={full}
          aria-label="Открывать развёрнутым"
          onChange={(event) => patch({ maximized: event.target.checked })}
        />
      </Row>
    </div>
  );
}

function Java() {
  const { settings, update } = useSettings();
  const { selected } = useGame();
  const toast = useToast();
  const { java } = settings;
  const patch = (next: Partial<SettingsData['java']>) => update({ java: { ...java, ...next } });
  const path = useDraft(java.path, (value) => patch({ path: value }));
  const args = useDraft(settings.jvm_args, (value) => update({ jvm_args: value }));

  return (
    <div className="panel">
      <h3>Среда выполнения</h3>
      <Row
        title="Источник"
        hint={
          java.mode === 'auto'
            ? `Лаунчер скачивает нужную версию сам.${selected?.manifest.java ? ` Для «${selected.pack.name}»: Java ${selected.manifest.java}` : ''}`
            : 'Укажите путь к javaw.exe'
        }
      >
        <div className="pills" role="group" aria-label="Источник Java">
          <button type="button" aria-pressed={java.mode === 'auto'} onClick={() => patch({ mode: 'auto' })}>
            Автоматически
          </button>
          <button type="button" aria-pressed={java.mode === 'custom'} onClick={() => patch({ mode: 'custom' })}>
            Своя
          </button>
        </div>
      </Row>
      {java.mode === 'custom' && (
        <div className={s.row}>
          <div className={s.path}>
            <input className={`inp ${s.mono}`} placeholder="C:\Program Files\Java\jdk-21\bin\javaw.exe" aria-label="Путь к Java" {...path} />
            <button
              className="btn sm"
              type="button"
              onClick={() => void pick({ filters: [{ name: 'Java', extensions: ['exe'] }] }, (file) => patch({ path: file }), toast)}
            >
              Обзор
            </button>
          </div>
        </div>
      )}
      <div className={`${s.row} ${s.column}`}>
        <label className="fld" htmlFor="jvm-args">
          <span>Аргументы JVM</span>
        </label>
        <textarea id="jvm-args" className="inp" rows={3} spellCheck={false} {...args} />
        <span className="hint">Память задаётся в разделе «Игра», -Xmx здесь не нужен.</span>
      </div>
    </div>
  );
}

function Behaviour() {
  const { settings, update } = useSettings();

  return (
    <div className="panel">
      <h3>Поведение</h3>
      <Row title="После запуска игры" hint="Закрытый лаунчер не занимает память, пока вы играете">
        <div className="pills" role="group" aria-label="После запуска игры">
          {AFTER_LAUNCH.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={settings.after_launch === value} onClick={() => update({ after_launch: value })}>
              {label}
            </button>
          ))}
        </div>
      </Row>
      {!isMac && (
        <Row title="Консоль игры" hint="Окно с логом, помогает разобраться с вылетами">
          <input
            type="checkbox"
            className="sw"
            checked={settings.console}
            aria-label="Консоль игры"
            onChange={(event) => update({ console: event.target.checked })}
          />
        </Row>
      )}
    </div>
  );
}

function Files() {
  const { settings, update } = useSettings();
  const toast = useToast();

  return (
    <div className="panel">
      <h3>Файлы</h3>
      <div className={s.row}>
        <div className={`${s.l} ${s.fixed}`}>
          <b>Папка игры</b>
          <span>Сборки, миры, скриншоты</span>
        </div>
        <div className={s.path}>
          <code>{settings.game_dir}</code>
          <button
            className="btn sm"
            type="button"
            onClick={() => openPath(settings.game_dir).catch((error: unknown) => toast('Не удалось открыть папку', errorText(error), { kind: 'warn' }))}
          >
            <Icon name="folder" size={16} />
            Открыть
          </button>
          <button
            className="btn sm ghost"
            type="button"
            onClick={() => void pick({ directory: true, defaultPath: settings.game_dir }, (game_dir) => update({ game_dir }), toast)}
          >
            Изменить
          </button>
        </div>
      </div>
    </div>
  );
}

function About() {
  const toast = useToast();
  const { packs, loadError } = useGame();
  const [version, setVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [line, setLine] = useState('Обновления проверяются при каждом запуске');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    void getVersion().then(setVersion);
  }, []);

  async function check() {
    setChecking(true);
    try {
      const update = await checkUpdate();
      setAvailable(update !== null);
      setLine(update ? `Доступна версия ${update.version}` : 'Установлена последняя версия · проверено только что');
    } catch (error) {
      toast('Не удалось проверить обновления', errorText(error), { kind: 'warn' });
    }
    setChecking(false);
  }

  return (
    <div className="panel">
      <Row title={`Версия ${version}`} hint={line}>
        <button className="btn sm" type="button" disabled={checking} onClick={() => void check()}>
          {checking ? (
            <>
              <Dots />
              Проверяем
            </>
          ) : (
            <>
              <Icon name="refresh" size={16} />
              Проверить обновления
            </>
          )}
        </button>
      </Row>
      {available && (
        <div className={s.row}>
          <UpdateInstall />
        </div>
      )}
      <Row title="Сервер аккаунтов" hint={__API_HOST__}>
        {loadError ? <span className="tag bad">Недоступен</span> : packs && <span className="tag ok">Доступен</span>}
      </Row>
    </div>
  );
}

const RESOLUTIONS = [
  [1280, 720],
  [1600, 900],
  [1920, 1080],
];

const AFTER_LAUNCH: [SettingsData['after_launch'], string][] = [
  ['close', 'Закрыть'],
  ['hide', 'Свернуть'],
  ['keep', 'Оставить'],
];

function Section({ id, title, icon, children }: { id: string; title: string; icon: ComponentProps<typeof Icon>['name']; children: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={`settings-${id}`}>
      <h2 className={s.sectionHead} id={`settings-${id}`}>
        <span className={s.sectionIcon}>
          <Icon name={icon} size={18} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.l}>
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      {children}
    </div>
  );
}

function useDraft(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  return {
    value: draft ?? value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: () => {
      if (draft !== null && draft !== value) onCommit(draft);
      setDraft(null);
    },
  };
}

async function pick(options: Parameters<typeof open>[0], apply: (path: string) => void, toast: ReturnType<typeof useToast>) {
  try {
    const path = await open(options);
    if (typeof path === 'string') apply(path);
  } catch (error) {
    toast('Не удалось открыть выбор', errorText(error), { kind: 'warn' });
  }
}

function pctStyle(value: number, min: number, max: number): CSSProperties {
  return { '--pct': `${(((value - min) / (max - min)) * 100).toFixed(1)}%` } as CSSProperties;
}

function formatGb(gb: number): string {
  return String(gb).replace('.', ',');
}
