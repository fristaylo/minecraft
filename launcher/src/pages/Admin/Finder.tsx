import { useState, type FormEvent } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { ModIcon } from '@components/ModIcon/ModIcon';
import { SourceTag } from '@components/SourceTag/SourceTag';
import { search, type Kind, type Manifest, type ManifestFile, type Scope, type SearchItem } from '@/api';
import { formatLoader } from '@/format';
import { useAttempt } from './attempt';
import s from './Admin.module.scss';

const SCOPES: [Scope, string][] = [
  ['both', 'Обе'],
  ['modrinth', 'Modrinth'],
  ['curseforge', 'CurseForge'],
  ['custom', 'Кастомные моды'],
];

const WHAT = { mod: 'мод', resourcepack: 'ресурспак', shader: 'шейдер', config: 'конфиг' };

export function Finder({
  draft,
  kind,
  files,
  onAdd,
  onOpen,
}: {
  draft: Pick<Manifest, 'minecraft' | 'loader'>;
  kind: Kind;
  files: ManifestFile[];
  onAdd: (item: SearchItem) => Promise<void>;
  onOpen: (item: SearchItem) => void;
}) {
  const attempt = useAttempt();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('both');
  const [results, setResults] = useState<SearchItem[] | 'loading' | null>(null);
  const [adding, setAdding] = useState<SearchItem['id'] | null>(null);
  const target = `${draft.minecraft} ${formatLoader(draft.loader)}`;

  async function run(event: FormEvent) {
    event.preventDefault();
    setResults('loading');
    await attempt(async () => {
      setResults(await search({ query: query.trim(), source: scope, kind, minecraft: draft.minecraft, loader: draft.loader.type }));
    });
    setResults((current) => (current === 'loading' ? null : current));
  }

  async function add(item: SearchItem) {
    setAdding(item.id);
    await onAdd(item);
    setAdding(null);
  }

  return (
    <div className={s.finder}>
      <form className="toolbar" style={{ margin: 0 }} onSubmit={(event) => void run(event)}>
        <div className="search">
          <Icon name="search" size={17} />
          <input
            className="inp"
            type="search"
            placeholder={scope === 'custom' ? 'Найти кастомный мод' : `Найти ${WHAT[kind]} на Modrinth и CurseForge`}
            aria-label="Поиск по площадкам"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="pills" role="group" aria-label="Площадка">
          {SCOPES.filter(([id]) => id !== 'custom' || kind === 'mod').map(([id, label]) => (
            <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn primary" type="submit" disabled={results === 'loading'}>
          Искать
        </button>
      </form>
      <div className={s.results}>
        {results === null ? (
          <span className="hint">Поиск сразу отметит, что не подходит к {target}. Зависимости добавятся сами.</span>
        ) : results === 'loading' ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={s.ri}>
              <div className="sk" style={{ width: 40, height: 40, borderRadius: 10 }} />
              <div className={s.skLines}>
                <div className="sk" style={{ height: 13, width: '36%' }} />
                <div className="sk" style={{ height: 10, width: '66%' }} />
              </div>
              <div className="sk" style={{ width: 104, height: 32 }} />
            </div>
          ))
        ) : results.length ? (
          results.map((item) => (
            <div key={`${item.source}:${item.id}`} className={s.ri}>
              <ModIcon iconUrl={item.iconUrl} size={40} />
              <div className={s.riMain}>
                <div className={s.nm}>
                  <button className="lnk" type="button" onClick={() => onOpen(item)}>
                    {item.title}
                  </button>
                  <SourceTag source={item.source} />
                </div>
                <div className={s.d}>
                  {item.author} · {formatDownloads(item.downloads)} загрузок · {item.description}
                </div>
                <div className={s.chips}>
                  <span className={`tag ${item.compatible ? 'ok' : 'bad'}`}>
                    {item.compatible ? `Есть версия для ${target}` : `Нет версии для ${target}`}
                  </span>
                </div>
              </div>
              {files.some((file) => file.meta?.projectId === item.id) ? (
                <span className="tag ok">В сборке</span>
              ) : (
                <button
                  className={`btn sm ${item.compatible ? 'primary' : ''}`}
                  type="button"
                  disabled={!item.compatible || adding !== null}
                  onClick={() => void add(item)}
                >
                  {adding === item.id ? <Dots /> : <Icon name="plus" size={16} stroke={2.2} />}
                  Добавить
                </button>
              )}
            </div>
          ))
        ) : (
          <span className="hint">Ничего не нашлось по запросу «{query}».</span>
        )}
      </div>
    </div>
  );
}

export function formatDownloads(count: number): string {
  if (count >= 1e6) return `${(count / 1e6).toFixed(1).replace('.', ',')} млн`;
  return count >= 1e3 ? `${Math.round(count / 1e3)} тыс` : String(count);
}
