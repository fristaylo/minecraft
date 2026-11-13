import type { ComponentProps } from 'react';

export function Blocks(props: Pick<ComponentProps<'span'>, 'style'>) {
  return (
    <span className="blocks" aria-hidden="true" {...props}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
