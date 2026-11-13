import { Icon } from '@components/Icon/Icon';
import type { Meta } from '@/api';
import s from './ModIcon.module.scss';

export function ModIcon({ iconUrl, size }: Pick<Meta, 'iconUrl'> & { size: number }) {
  const style = { width: size, height: size, borderRadius: size / 4 };
  return iconUrl ? (
    <img className={s.icon} src={iconUrl} alt="" style={style} />
  ) : (
    <span className={`${s.icon} ${s.blank}`} style={style}>
      <Icon name="box" size={size / 2} />
    </span>
  );
}
