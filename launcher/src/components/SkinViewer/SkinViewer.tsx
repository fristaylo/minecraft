import { useEffect, useRef, useState } from 'react';
import { IdleAnimation, RunningAnimation, SkinViewer as Viewer3d, WalkingAnimation } from 'skinview3d';
import { Blocks } from '@components/Loaders/Loaders';
import type { Me, Skin, SkinModel } from '@/api';
import s from './SkinViewer.module.scss';

type Animation = keyof typeof ANIMATIONS;

const ANIMATIONS = { idle: IdleAnimation, walk: WalkingAnimation, run: RunningAnimation };

const ANIMATION_LABELS: [Animation, string][] = [
  ['idle', 'Стоит'],
  ['walk', 'Идёт'],
  ['run', 'Бежит'],
];

export function SkinViewer({
  name,
  skin,
  model,
  minHeight,
}: {
  name: Me['name'];
  skin: Pick<Skin, 'url'> | null;
  model: SkinModel;
  minHeight?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [viewer, setViewer] = useState<Viewer3d>();
  const [ready, setReady] = useState(false);
  const [animation, setAnimation] = useState<Animation>('idle');
  const [rotate, setRotate] = useState(true);

  useEffect(() => {
    if (!box.current || !canvas.current) return;
    const created = new Viewer3d({ canvas: canvas.current, width: box.current.clientWidth, height: box.current.clientHeight });
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
    <div ref={box} className={s.viewer} style={{ minHeight }}>
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
            <button key={value} type="button" aria-pressed={animation === value} onClick={() => setAnimation(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className={`check ${s.rotate}`}>
          <input type="checkbox" className="sw" checked={rotate} onChange={(event) => setRotate(event.target.checked)} /> Вращать
        </label>
      </div>
    </div>
  );
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
