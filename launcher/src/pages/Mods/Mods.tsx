import { useState } from 'react';
import { FileDrawer } from '@components/ModDrawer/ModDrawer';
import { Icon } from '@components/Icon/Icon';
import { Blocks } from '@components/Loaders/Loaders';
import { ModIcon } from '@components/ModIcon/ModIcon';
import { blockIcon } from '@components/Scene/pixels';
import type { Kind, ManifestFile } from '@/api';
import { useGame, type PackInfo } from '@/context/Game';
import { useToast } from '@/context/Toast';
import { dependentsOf, fileTitle, formatFileSize, formatLoader, needLabel, SIDES } from '@/format';
import s from './Mods.module.scss';

const TABS: [Kind, string][] = [
  ['mod', 'Моды'],
  ['resourcepack', 'Ресурспаки'],
  ['shader', 'Шейдеры'],
];

const FILTERS = [
  ['all', 'Все'],
  ['req', 'Обязательные'],
  ['opt', 'Опциональные'],
  ['off', 'Выключенные'],
] as const;

type Filter = (typeof FILTERS)[number][0];

export function Mods() {
  const { packs, selected, toggleOptional } = useGame();
  const toast = useToast();
  const [packId, setPackId] = useState<string>();
  const [tab, setTab] = useState<Kind>('mod');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ManifestFile['path'] | null>(null);
  const info = packs?.find(({ pack }) => pack.id === packId) ?? selected;

  if (!packs || !info) {
    return (
      <div className="empty">
        {packs ? (
          <>
            <b>Сборок пока нет</b>
            <span>Админ сервера ещё ничего не опубликовал.</span>
          </>
        ) : (
          <Blocks />
        )}
      </div>
    );
  }

  const files = info.manifest.files.filter((file) => file.side !== 'server' && file.kind !== 'config');
  const list = files.filter((file) => file.kind === tab);
  const text = query.trim().toLowerCase();
  const shown = list.filter(
    (file) =>
      matches(filter, file, isEnabled(info, file)) &&
      (!text || fileTitle(file).toLowerCase().includes(text) || file.meta?.author.toLowerCase().includes(text)),
  );
  const opened = files.find((file) => file.path === open);

  async function toggle(id: PackInfo['pack']['id'], file: ManifestFile, enabled: boolean) {
    await toggleOptional(id, file.path, enabled);
    toast(enabled ? `${fileTitle(file)} включён` : `${fileTitle(file)} выключен`, 'Применится при следующем запуске.', { kind: 'info' });
  }

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Моды</h1>
          <p>Обязательные моды задаёт сервер. Опциональные включаете вы, изменения применятся при следующем запуске.</p>
        </div>
        {packs.length > 1 && (
          <label className={`fld ${s.pack}`}>
            <span>Сборка</span>
            <select className="inp" value={info.pack.id} onChange={(event) => {
                setPackId(event.target.value);
                setOpen(null);
              }}>
              {packs.map(({ pack }) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} · {pack.minecraft} {formatLoader(pack.loader)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="toolbar">
        <div className="pills" role="tablist">
          {TABS.map(([kind, label]) => (
            <button key={kind} type="button" role="tab" aria-selected={tab === kind} onClick={() => setTab(kind)}>
              {label}
              <span className="n">{files.filter((file) => file.kind === kind).length}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" size={17} />
          <input
            className="inp"
            type="search"
            placeholder="Поиск по названию или автору"
            aria-label="Поиск модов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="pills" role="group" aria-label="Фильтр">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={s.list}>
        {shown.length ? (
          shown.map((file) => {
            const enabled = isEnabled(info, file);
            const needed = dependentsOf(files, file).length;
            return (
              <div key={file.path} className={`${s.li} ${file.optional && !enabled ? s.off : ''}`}>
                <ModIcon iconUrl={file.meta?.iconUrl ?? ''} size={40} />
                <div className={s.main}>
                  <div className={s.nm}>
                    {file.meta ? (
                      <button className="lnk" type="button" onClick={() => setOpen(file.path)}>
                        {fileTitle(file)}
                      </button>
                    ) : (
                      fileTitle(file)
                    )}
                  </div>
                  <div className={s.sub}>
                    {[file.meta?.author, formatFileSize(file.size), needed ? needLabel(needed) : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className={s.tags}>
                  <span className="tag">{SIDES[file.side]}</span>
                  {file.optional && <span className="tag">Опционально</span>}
                </div>
                {file.optional ? (
                  <input
                    className="sw"
                    type="checkbox"
                    checked={enabled}
                    aria-label={`Включить ${fileTitle(file)}`}
                    onChange={(event) => void toggle(info.pack.id, file, event.target.checked)}
                  />
                ) : (
                  <span className={s.lock} title="Обязательный мод">
                    <Icon name="lock" size={17} />
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <Empty info={info} count={list.length} tab={tab} />
        )}
      </div>
      {opened?.meta && (
        <FileDrawer
          files={files}
          file={{ ...opened, meta: opened.meta }}
          userTag={(user) => (user.optional ? (isEnabled(info, user) ? 'включён' : 'выключен') : 'обязательный')}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        >
          <span className="hint">{opened.optional ? 'Включается переключателем в списке' : 'Обязательный, его задаёт сервер'}</span>
        </FileDrawer>
      )}
    </>
  );
}

function Empty({ info, count, tab }: { info: PackInfo; count: number; tab: Kind }) {
  if (count) {
    return (
      <div className="empty">
        <b>Ничего не нашлось</b>
        <span>Попробуйте другое название или сбросьте фильтр.</span>
      </div>
    );
  }
  return (
    <div className="empty">
      <img src={blockIcon(info.pack.theme)} alt="" />
      <b>{tab === 'mod' ? 'В этой сборке нет модов' : 'Здесь пока пусто'}</b>
      <span>{tab === 'mod' ? 'Чистая игра без изменений.' : 'Админ ещё не добавил сюда файлы.'}</span>
    </div>
  );
}

function isEnabled({ local }: PackInfo, file: ManifestFile): boolean {
  return local.optional[file.path] ?? file.defaultEnabled;
}

function matches(filter: Filter, file: ManifestFile, enabled: boolean): boolean {
  if (filter === 'req') return !file.optional;
  if (filter === 'opt') return file.optional;
  if (filter === 'off') return file.optional && !enabled;
  return true;
}
