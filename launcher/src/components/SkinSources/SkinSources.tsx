import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { ModelPicker } from '@components/ModelPicker/ModelPicker';
import { SkinCatalog } from '@components/SkinCatalog/SkinCatalog';
import {
  errorText,
  listSkins,
  mineskinSearch,
  mojangSkin,
  type CatalogSkin,
  type MineskinPage,
  type MojangSkin,
  type Skin,
  type SkinImport,
  type SkinModel,
} from '@/api';
import { useToast } from '@/context/Toast';
import { pathName } from '@/format';
import s from './SkinSources.module.scss';

export type Picked =
  | { kind: 'catalog'; skin: CatalogSkin }
  | { kind: 'import'; name: string; skin: Skin; source: SkinImport['source']; skinId?: string }
  | { kind: 'file'; name: string; path: string; model: SkinModel };

type Source = keyof typeof SOURCES;

type OnPick = (picked: Picked) => void;

const SOURCES = { catalog: 'Каталог', mineskin: 'MineSkin', mojang: 'По нику', file: 'PNG-файл' };

export function SkinSources({ catalog, picked, onPick }: { catalog: CatalogSkin[] | null; picked: Picked | null; onPick: OnPick }) {
  const [source, setSource] = useState<Source>('catalog');

  return (
    <div className={s.stack}>
      <div className="pills" role="group" aria-label="Источник скина">
        {(Object.keys(SOURCES) as Source[]).map((id) => (
          <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)}>
            {SOURCES[id]}
          </button>
        ))}
      </div>
      {source === 'catalog' &&
        (catalog ? (
          <SkinCatalog
            items={catalog}
            itemKey={(item) => item.id}
            selected={picked?.kind === 'catalog' ? picked.skin.id : null}
            empty="Каталог пока пуст"
            onSelect={(skin) => onPick({ kind: 'catalog', skin })}
          />
        ) : (
          <p className="hint">Загружаем каталог</p>
        ))}
      {source === 'mineskin' && <Mineskin picked={picked} onPick={onPick} />}
      {source === 'mojang' && <Nickname picked={picked} onPick={onPick} />}
      {source === 'file' && <Upload picked={picked} onPick={onPick} />}
    </div>
  );
}

export function useCatalog() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogSkin[] | null>(null);

  const load = useCallback(async () => {
    try {
      setCatalog(await listSkins());
    } catch (error) {
      setCatalog([]);
      toast('Не удалось загрузить каталог', errorText(error), { kind: 'warn' });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return [catalog, load] as const;
}

export function previewOf(picked: Picked | null): Skin | null {
  return picked && picked.kind !== 'file' ? picked.skin : null;
}

export function importArgs(picked: Extract<Picked, { kind: 'import' }>): SkinImport {
  return { source: picked.source, skinId: picked.skinId, name: picked.name };
}

function Mineskin({ picked, onPick }: { picked: Picked | null; onPick: OnPick }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<MineskinPage | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(text: string, after?: string) {
    setBusy(true);
    try {
      const result = await mineskinSearch({ query: text || undefined, after });
      setQuery(text);
      setPage({ items: [...(after ? (page?.items ?? []) : []), ...result.items], next: result.next });
    } catch (error) {
      toast('Не удалось найти скины', errorText(error), { kind: 'warn' });
    }
    setBusy(false);
  }

  return (
    <>
      <SearchForm placeholder="Название скина" busy={busy} onSearch={(text) => load(text)} />
      {page && (
        <SkinCatalog
          items={page.items.map((item) => ({ ...item, url: item.previewUrl, model: 'classic' as const }))}
          itemKey={(item) => item.id}
          selected={picked?.kind === 'import' ? (picked.skinId ?? null) : null}
          empty="Ничего не найдено"
          onSelect={(item) => onPick({ kind: 'import', name: item.name, skin: { url: item.url, model: item.model }, source: 'mineskin', skinId: item.id })}
        />
      )}
      {page?.next && (
        <button className="btn" type="button" disabled={busy} onClick={() => void load(query, page.next ?? undefined)}>
          Ещё
        </button>
      )}
    </>
  );
}

function Nickname({ picked, onPick }: { picked: Picked | null; onPick: OnPick }) {
  const toast = useToast();
  const [found, setFound] = useState<MojangSkin | null>(null);
  const [busy, setBusy] = useState(false);

  async function find(name: string) {
    setBusy(true);
    try {
      setFound(await mojangSkin(name));
    } catch (error) {
      toast('Скин не найден', errorText(error), { kind: 'warn' });
    }
    setBusy(false);
  }

  return (
    <>
      <SearchForm placeholder="Ник игрока Minecraft" busy={busy} onSearch={find} />
      {found && (
        <SkinCatalog
          items={[{ ...found, url: found.previewUrl }]}
          itemKey={(item) => item.name}
          selected={picked?.kind === 'import' && picked.source === 'mojang' ? picked.name : null}
          onSelect={(item) => onPick({ kind: 'import', name: item.name, skin: { url: item.url, model: item.model }, source: 'mojang' })}
        />
      )}
    </>
  );
}

function Upload({ picked, onPick }: { picked: Picked | null; onPick: OnPick }) {
  const toast = useToast();
  const file = picked?.kind === 'file' ? picked : null;
  const [model, setModel] = useState<SkinModel>(file?.model ?? 'classic');

  async function choose() {
    try {
      const path = await open({ filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (typeof path === 'string') onPick({ kind: 'file', path, model, name: pathName(path).replace(/\.png$/i, '') });
    } catch (error) {
      toast('Не удалось открыть выбор файла', errorText(error), { kind: 'warn' });
    }
  }

  function change(next: SkinModel) {
    setModel(next);
    if (file) onPick({ ...file, model: next });
  }

  return (
    <>
      <ModelPicker value={model} onChange={change} />
      <div className={s.upload}>
        <button className="btn" type="button" onClick={() => void choose()}>
          <Icon name={file ? 'check' : 'upload'} size={16} />
          Выбрать PNG
        </button>
        <span className="hint">{file ? pathName(file.path) : 'Размер 64×64 или 64×32 пикселя'}</span>
      </div>
    </>
  );
}

function SearchForm({ placeholder, busy, onSearch }: { placeholder: string; busy: boolean; onSearch: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSearch(text.trim());
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <input className="inp" type="search" placeholder={placeholder} aria-label={placeholder} value={text} onChange={(event) => setText(event.target.value)} />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? <Dots /> : <Icon name="search" size={16} />}
        Найти
      </button>
    </form>
  );
}
