import type { CSSProperties } from 'react';
import type { Me } from '@/api';
import s from './Face.module.scss';

export function Face({ account, size }: { account: Pick<Me, 'name' | 'skin'>; size: number }) {
  const style = { '--s': `${size / 8}px`, width: size, height: size } as CSSProperties;
  if (!account.skin) {
    return (
      <span className={`${s.face} ${s.empty}`} style={style}>
        {account.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <span className={s.face} style={{ ...style, backgroundImage: `url(${account.skin.url}), url(${account.skin.url})` }} />;
}
