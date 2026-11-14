import { Face } from '@components/Face/Face';
import type { CatalogSkin } from '@/api';
import s from './SkinCatalog.module.scss';

type Item = Pick<CatalogSkin, 'name' | 'url' | 'model'>;

export function SkinCatalog<T extends Item>({
  items,
  itemKey,
  selected,
  empty = 'Скинов пока нет',
  onSelect,
}: {
  items: T[];
  itemKey: (item: T) => string | number;
  selected: string | number | null;
  empty?: string;
  onSelect: (item: T) => void;
}) {
  if (!items.length) return <p className="hint">{empty}</p>;
  return (
    <div className={s.grid}>
      {items.map((item) => (
        <button key={itemKey(item)} className={s.item} type="button" aria-pressed={itemKey(item) === selected} title={item.name} onClick={() => onSelect(item)}>
          <Face account={{ name: item.name, skin: item }} size={48} />
          <span>{item.name}</span>
        </button>
      ))}
    </div>
  );
}
