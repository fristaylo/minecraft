import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Icon } from '@components/Icon/Icon';
import s from './Toast.module.scss';

type Kind = 'ok' | 'warn' | 'info';

type Options = {
  kind?: Kind;
  icon?: ComponentProps<typeof Icon>['name'];
  sticky?: boolean;
  body?: (close: () => void) => ReactNode;
};

type Item = Pick<Options, 'kind' | 'icon' | 'body'> & { id: number; title: string; desc: string; out: boolean };

type Api = { toast: (title: string, desc?: string, options?: Options) => void };

const ToastContext = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, out: true } : item)));
    setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 220);
  }, []);

  const api = useMemo<Api>(
    () => ({
      toast(title, desc = '', { sticky, ...options } = {}) {
        const id = nextId.current++;
        setItems((list) => [...list, { ...options, id, title, desc, out: false }]);
        if (!sticky) setTimeout(() => dismiss(id), 3800);
      },
    }),
    [dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div className={s.toasts}>
        {items.map(({ id, title, desc, kind = 'ok', icon, body, out }) => (
          <div key={id} className={`${s.toast} ${out ? s.out : ''}`} role="status">
            <span className={`${s.icon} ${s[kind]}`}>
              <Icon name={icon ?? ICONS[kind]} size={17} stroke={2.2} />
            </span>
            <div className={s.text}>
              <div className={s.title}>{title}</div>
              {desc && <div className={s.desc}>{desc}</div>}
              {body?.(() => dismiss(id))}
            </div>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error('ToastProvider is missing');
  return api.toast;
}

const ICONS = { ok: 'check', warn: 'warn', info: 'info' } as const;
