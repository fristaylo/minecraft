import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@components/Icon/Icon';
import { Blocks } from '@components/Loaders/Loaders';
import { blockIcon } from '@components/Scene/pixels';
import { adminPacks, createPack, errorText, type AdminPack } from '@/api';
import { useGame } from '@/context/Game';
import { useToast } from '@/context/Toast';
import { formatLoader } from '@/format';
import { MetaForm } from './MetaForm';
import { PackEditor } from './PackEditor';
import s from './Admin.module.scss';

const NEW = Symbol('new');

export function Packs() {
  const toast = useToast();
  const { reload } = useGame();
  const [packs, setPacks] = useState<AdminPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AdminPack['id'] | typeof NEW | null>(null);

  const load = useCallback(async () => {
    try {
      setPacks(await adminPacks());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="empty">
        <b>Не удалось загрузить сборки</b>
        <span>{error}</span>
        <button className="btn" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={16} />
          Повторить
        </button>
      </div>
    );
  }
  if (!packs) {
    return (
      <div className="empty">
        <Blocks />
      </div>
    );
  }

  const pack = current === NEW ? undefined : (packs.find(({ id }) => id === current) ?? packs[0]);

  return (
    <div className={s.admin}>
      <div className={s.alist}>
        {packs.map(({ id, name, theme, version, loaderType, loaderVersion }) => (
          <button key={id} className={s.aitem} type="button" aria-current={id === pack?.id} onClick={() => {
              setCurrent(id);
              void load();
            }}>
            <img src={blockIcon(theme)} alt="" />
            <span>
              <b>{name}</b>
              <span>
                {version ?? 'не опубликована'} · {formatLoader({ type: loaderType, version: loaderVersion })}
              </span>
            </span>
          </button>
        ))}
        <button className={s.anew} type="button" onClick={() => setCurrent(NEW)}>
          <Icon name="plus" size={18} />
          Новая сборка
        </button>
      </div>
      {current === NEW ? (
        <MetaForm
          key="new"
          onSave={async (meta, id) => {
            await createPack(id, meta);
            await load();
            setCurrent(id);
            toast('Сборка создана', 'Добавьте моды и опубликуйте первую версию.');
          }}
        />
      ) : pack ? (
        <PackEditor
          key={pack.id}
          pack={pack}
          onSaved={async () => {
            await load();
            await reload();
          }}
          onDeleted={async () => {
            setCurrent(null);
            await load();
            await reload();
          }}
        />
      ) : (
        <div className="panel">
          <div className="empty">
            <b>Сборок пока нет</b>
            <span>Создайте первую кнопкой «Новая сборка».</span>
          </div>
        </div>
      )}
    </div>
  );
}
