import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@components/Icon/Icon';
import s from './Modal.module.scss';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={s.bg} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.head}>
          <b>{title}</b>
          <button className="btn ghost icon" type="button" aria-label="Закрыть" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className={`${s.body} scroll`}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
