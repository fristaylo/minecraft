import { useEffect, useRef, type ComponentProps } from 'react';
import type { Theme } from '@/api';
import { createScene, paintScene } from './pixels';

export function Scene({
  theme,
  seed,
  width,
  height,
  animated = false,
  className,
}: { theme: Theme; seed: string; width: number; height: number; animated?: boolean } & Pick<ComponentProps<'canvas'>, 'className'>) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scene = createScene(theme, seed, width, height);
    paintScene(canvas, scene, 0);
    if (!animated || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let offset = 0;
    let last = 0;
    let frame = requestAnimationFrame(function tick(time) {
      if (time - last > 60) {
        last = time;
        paintScene(canvas, scene, ++offset);
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [theme, seed, width, height, animated]);

  return <canvas ref={ref} className={className} width={width} height={height} />;
}
