import { ask } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { SkinSources, importArgs, previewOf, useCatalog, type Picked } from '@components/SkinSources/SkinSources';
import { SkinViewer } from '@components/SkinViewer/SkinViewer';
import { deleteCatalogSkin, importCatalogSkin, uploadCatalogSkin } from '@/api';
import { useToast } from '@/context/Toast';
import { useAttempt } from './attempt';
import s from './Admin.module.scss';

export function Skins() {
  const toast = useToast();
  const attempt = useAttempt();
  const [catalog, reload] = useCatalog();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const skin = previewOf(picked);

  function pick(next: Picked) {
    setPicked(next);
    setName(next.kind === 'catalog' ? '' : next.name);
  }

  async function add(item: Exclude<Picked, { kind: 'catalog' }>) {
    setBusy(true);
    await attempt(async () => {
      if (item.kind === 'import') await importCatalogSkin({ ...importArgs(item), name });
      else await uploadCatalogSkin({ path: item.path, model: item.model, name });
      toast('Скин добавлен', `«${name}» теперь в каталоге.`);
      setPicked(null);
      await reload();
    });
    setBusy(false);
  }

  async function remove(item: Extract<Picked, { kind: 'catalog' }>) {
    const confirmed = await ask(`Удалить скин «${item.skin.name}» из каталога? У игроков он останется.`, {
      title: 'Удаление скина',
      kind: 'warning',
      okLabel: 'Удалить',
      cancelLabel: 'Отмена',
    });
    if (!confirmed) return;
    await attempt(async () => {
      await deleteCatalogSkin(item.skin.id);
      toast('Скин удалён', `«${item.skin.name}» убран из каталога.`, { kind: 'info' });
      setPicked(null);
      await reload();
    });
  }

  return (
    <div className={s.skinGrid}>
      <SkinViewer
        name={picked?.kind === 'catalog' ? picked.skin.name : (picked?.name ?? 'Предпросмотр')}
        skin={skin}
        model={picked?.kind === 'file' ? picked.model : (skin?.model ?? 'classic')}
      />
      <div className={s.skinSide}>
        <div className="panel">
          <SkinSources catalog={catalog} picked={picked} onPick={pick} />
        </div>
        {picked?.kind === 'catalog' && (
          <div className={s.skinActions}>
            <button className="btn ghost" type="button" onClick={() => void remove(picked)}>
              <Icon name="trash" size={16} />
              Удалить из каталога
            </button>
          </div>
        )}
        {picked && picked.kind !== 'catalog' && (
          <div className="panel">
            <h3>Добавить в каталог</h3>
            <div className={s.skinActions}>
              <input
                className="inp"
                placeholder="Название в каталоге"
                aria-label="Название в каталоге"
                maxLength={64}
                value={name}
                disabled={picked.kind === 'import' && picked.source === 'mojang'}
                onChange={(event) => setName(event.target.value)}
              />
              <button className="btn primary" type="button" disabled={busy || !name.trim()} onClick={() => void add(picked)}>
                {busy ? (
                  <>
                    <Dots />
                    Добавляем
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} />
                    Добавить в каталог
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
