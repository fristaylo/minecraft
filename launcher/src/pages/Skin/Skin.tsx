import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useRef, useState } from 'react';
import { IdleAnimation, RunningAnimation, SkinViewer, WalkingAnimation } from 'skinview3d';
import { Blocks, Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { errorText, resetSkin, uploadSkin, type Me, type SkinModel } from '@/api';
import { useAccount, useSession } from '@/context/Session';
import { useToast } from '@/context/Toast';
import s from './Skin.module.scss';

type Animation = keyof typeof ANIMATIONS;

const ANIMATIONS = { idle: IdleAnimation, walk: WalkingAnimation, run: RunningAnimation };

export function Skin() {
  const account = useAccount();
  const { setAccount } = useSession();
  const toast = useToast();
  const [model, setModel] = useState<SkinModel>(account.skin?.model ?? 'classic');
  const [file, setFile] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [animation, setAnimation] = useState<Animation>('idle');
  const [rotate, setRotate] = useState(true);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      setOver(payload.type === 'enter' || payload.type === 'over');
      if (payload.type !== 'drop') return;
      const png = payload.paths.find((path) => /\.png$/i.test(path));
      if (png) setFile(png);
      else toast('Нужен PNG-файл', 'Скин должен быть картинкой в формате PNG.', { kind: 'warn' });
    });
    return () => void unlisten.then((stop) => stop());
  }, [toast]);

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Скин</h1>
          <p>Скин хранится на сервере аккаунтов. Другие игроки увидят его после вашего перезахода.</p>
        </div>
      </div>
      <div className={s.grid}>
        <Viewer name={account.name} skin={account.skin} model={model} animation={animation} rotate={rotate} onAnimation={setAnimation} onRotate={setRotate} />
        <div className={s.stack}>
          <div className="panel">
            <h3>Модель</h3>
            <div className={s.models}>
              {MODELS.map(([value, title, hint]) => (
                <button key={value} className={s.opt} type="button" aria-pressed={model === value} onClick={() => setModel(value)}>
                  <b>{title}</b>
                  <span>{hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3>Свой скин</h3>
            <button className={`${s.drop} ${over ? s.over : ''}`} type="button" onClick={() => void choose()}>
              <span className={s.dropIcon}>
                <Icon name={file ? 'check' : 'upload'} size={20} />
              </span>
              <span>
                <b>{file ? fileName(file) : 'Перетащите PNG или выберите файл'}</b>
                {file ? 'Нажмите «Сохранить скин», чтобы загрузить его на сервер' : 'Размер 64×64 или 64×32 пикселя'}
              </span>
            </button>
          </div>
          <div className={s.actions}>
            <button className="btn primary" type="button" disabled={!file || busy !== null} onClick={() => void save()}>
              {busy === 'save' ? (
                <>
                  <Dots />
                  Сохраняем
                </>
              ) : (
                <>
                  <Icon name="check" size={18} stroke={2.2} />
                  Сохранить скин
                </>
              )}
            </button>
            <button className="btn ghost" type="button" disabled={!account.skin || busy !== null} onClick={() => void reset()}>
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </>
  );

  async function choose() {
    try {
      const path = await open({ filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (typeof path === 'string') setFile(path);
    } catch (error) {
      toast('Не удалось открыть выбор файла', errorText(error), { kind: 'warn' });
    }
  }

  async function save() {
    if (!file) return;
    await run('save', () => uploadSkin(file, model), 'Скин сохранён', 'Другие игроки увидят его после вашего перезахода на сервер.');
    setFile(null);
  }

  async function reset() {
    await run('reset', resetSkin, 'Скин сброшен', 'Снова используется стандартный скин.');
  }

  async function run(kind: 'save' | 'reset', action: () => Promise<Me>, title: string, desc: string) {
    setBusy(kind);
    try {
      setAccount(await action());
      toast(title, desc);
    } catch (error) {
      toast('Не удалось изменить скин', errorText(error), { kind: 'warn' });
    }
    setBusy(null);
  }
}

function Viewer({
  name,
  skin,
  model,
  animation,
  rotate,
  onAnimation,
  onRotate,
}: {
  name: Me['name'];
  skin: Me['skin'];
  model: SkinModel;
  animation: Animation;
  rotate: boolean;
  onAnimation: (animation: Animation) => void;
  onRotate: (rotate: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [viewer, setViewer] = useState<SkinViewer>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!box.current || !canvas.current) return;
    const created = new SkinViewer({ canvas: canvas.current, width: box.current.clientWidth, height: box.current.clientHeight });
    created.zoom = 0.8;
    created.fov = 40;
    created.autoRotateSpeed = 0.55;
    const observer = new ResizeObserver(([entry]) => created.setSize(entry.contentRect.width, entry.contentRect.height));
    observer.observe(box.current);
    setViewer(created);
    return () => {
      observer.disconnect();
      created.dispose();
    };
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const options = { model: model === 'slim' ? 'slim' : 'default' } as const;
    viewer
      .loadSkin(skin?.url ?? defaultSkin(), options)
      .catch(() => viewer.loadSkin(defaultSkin(), options))
      .then(() => setReady(true));
  }, [viewer, skin?.url, model]);

  useEffect(() => {
    if (viewer) viewer.autoRotate = rotate;
  }, [viewer, rotate]);

  useEffect(() => {
    if (viewer) viewer.animation = new ANIMATIONS[animation]();
  }, [viewer, animation]);

  return (
    <div ref={box} className={s.viewer}>
      <div className={s.name}>
        <b>{name}</b>
        <span className="hint">{model === 'slim' ? 'Тонкая модель' : 'Классическая модель'}</span>
      </div>
      <canvas ref={canvas} className={s.canvas} />
      <div className={`${s.load} ${ready ? s.done : ''}`}>
        <Blocks style={{ transform: 'scale(1.6)' }} />
      </div>
      <div className={s.controls}>
        <div className="pills" role="group" aria-label="Анимация">
          {ANIMATION_LABELS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={animation === value} onClick={() => onAnimation(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className={`check ${s.rotate}`}>
          <input type="checkbox" className="sw" checked={rotate} onChange={(event) => onRotate(event.target.checked)} /> Вращать
        </label>
      </div>
    </div>
  );
}

const MODELS: [SkinModel, string, string][] = [
  ['classic', 'Классическая', 'Руки шириной 4 пикселя'],
  ['slim', 'Тонкая', 'Руки шириной 3 пикселя'],
];

const ANIMATION_LABELS: [Animation, string][] = [
  ['idle', 'Стоит'],
  ['walk', 'Идёт'],
  ['run', 'Бежит'],
];

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function defaultSkin(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const fill = (color: string, ...boxes: number[][]) => {
    g.fillStyle = color;
    boxes.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  };
  fill('#e0b48c', [0, 8, 32, 8], [8, 0, 16, 8], [40, 16, 16, 16], [32, 48, 16, 16]);
  fill('#c2611f', [8, 0, 8, 8], [24, 8, 8, 8], [0, 8, 8, 3], [16, 8, 8, 3], [0, 8, 2, 6], [22, 8, 2, 6], [8, 8, 8, 2]);
  fill('#f4f4f4', [9, 12, 1, 1], [14, 12, 1, 1]);
  fill('#2f5d3a', [10, 12, 1, 1], [13, 12, 1, 1]);
  fill('#3f7a8f', [16, 16, 24, 16], [40, 20, 16, 5], [44, 16, 4, 4], [32, 52, 16, 5], [36, 48, 4, 4]);
  fill('#33384a', [0, 16, 16, 16], [16, 48, 16, 16], [16, 30, 24, 2]);
  fill('#2a2522', [0, 29, 16, 3], [16, 61, 16, 3]);
  return canvas.toDataURL();
}
