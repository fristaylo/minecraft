import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { ModIcon } from '@components/ModIcon/ModIcon';
import { SourceTag } from '@components/SourceTag/SourceTag';
import type { Kind, ManifestFile, Policy, Side, Update } from '@/api';
import { dependentsOf, fileName, fileTitle, formatFileSize, needLabel } from '@/format';
import s from './Admin.module.scss';

export type ManualState = 'wait' | 'ok';

const HEAD = { mod: 'Мод', resourcepack: 'Ресурспак', shader: 'Шейдер', config: 'Файл' };

const SIDE_OPTIONS: [Side, string][] = [
  ['both', 'Оба'],
  ['client', 'Клиент'],
  ['server', 'Сервер'],
];

const POLICIES: [Policy, string][] = [
  ['once', 'Только если игрок не менял'],
  ['managed', 'Всегда перезаписывать'],
];

export function FilesTable({
  kind,
  files,
  all,
  updates,
  manual,
  busy,
  onOpen,
  onSide,
  onOptional,
  onRemove,
  onUpdate,
  onManual,
}: {
  kind: Kind;
  files: ManifestFile[];
  all: ManifestFile[];
  updates: Update[] | null;
  manual: Record<ManifestFile['path'], ManualState>;
  busy: boolean;
  onOpen: (path: ManifestFile['path']) => void;
  onSide: (file: ManifestFile, side: Side) => void;
  onOptional: (file: ManifestFile, optional: boolean) => void;
  onRemove: (file: ManifestFile) => void;
  onUpdate: (path: ManifestFile['path']) => void;
  onManual: (path: ManifestFile['path']) => void;
}) {
  return (
    <div className={`panel scroll ${s.tblwrap}`}>
      <table className={s.tbl}>
        <thead>
          <tr>
            <th>{HEAD[kind]}</th>
            <th>Файл</th>
            <th>Сторона</th>
            <th>Опционально</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const needed = dependentsOf(all, file).length;
            const update = updates?.find(({ path }) => path === file.path);
            return (
              <tr key={file.path}>
                <td>
                  <div className={s.cm}>
                    <ModIcon iconUrl={file.meta?.iconUrl ?? ''} size={32} />
                    <div className={s.cmMain}>
                      {file.meta ? (
                        <button className="lnk" type="button" onClick={() => onOpen(file.path)}>
                          {fileTitle(file)}
                        </button>
                      ) : (
                        <b>{fileTitle(file)}</b>
                      )}
                      <span className={s.cmTags}>
                        {file.meta && <SourceTag source={file.meta.source} />}
                        {needed > 0 && <span className="tag">{needLabel(needed)}</span>}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  {file.meta?.source === 'manual' ? (
                    <Manual state={manual[file.path]} onOpen={() => onManual(file.path)} />
                  ) : update ? (
                    <span className={s.upd}>
                      <span className={s.cur}>{fileName(file.path)}</span>→ {update.latest.fileName}
                      <button className="btn sm gold" type="button" disabled={busy} onClick={() => onUpdate(file.path)}>
                        Обновить
                      </button>
                    </span>
                  ) : (
                    <span className="pct">{fileName(file.path)}</span>
                  )}
                </td>
                <td>
                  <select
                    className="inp"
                    aria-label={`Сторона ${fileTitle(file)}`}
                    value={file.side}
                    onChange={(event) => onSide(file, event.target.value as Side)}
                  >
                    {SIDE_OPTIONS.map(([side, label]) => (
                      <option key={side} value={side}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="cbx"
                    type="checkbox"
                    checked={file.optional}
                    aria-label={`${fileTitle(file)} опционально`}
                    onChange={(event) => onOptional(file, event.target.checked)}
                  />
                </td>
                <td>
                  <button className="btn ghost icon sm" type="button" aria-label={`Убрать ${fileTitle(file)}`} onClick={() => onRemove(file)}>
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ConfigList({
  files,
  onPolicy,
  onRemove,
}: {
  files: ManifestFile[];
  onPolicy: (file: ManifestFile, policy: Policy) => void;
  onRemove: (file: ManifestFile) => void;
}) {
  return (
    <div className={`panel ${s.cfg}`}>
      {files.length ? (
        files.map((file) => (
          <div key={file.path} className={s.cfgRow}>
            <code>{file.path}</code>
            <span className="hint pct">{formatFileSize(file.size)}</span>
            <select
              className="inp"
              aria-label={`Правило для ${file.path}`}
              value={file.policy}
              onChange={(event) => onPolicy(file, event.target.value as Policy)}
            >
              {POLICIES.map(([policy, label]) => (
                <option key={policy} value={policy}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn ghost icon sm" type="button" aria-label={`Убрать ${file.path}`} onClick={() => onRemove(file)}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          <b>Конфигов нет</b>
          <span>Добавьте файлы из папки config или options.txt.</span>
        </div>
      )}
    </div>
  );
}

function Manual({ state, onOpen }: { state: ManualState | undefined; onOpen: () => void }) {
  if (state === 'ok') {
    return (
      <span className={`${s.manual} ${s.found}`}>
        <Icon name="check" size={15} stroke={2.4} />
        Файл найден, хеш совпал
      </span>
    );
  }
  if (state === 'wait') {
    return (
      <span className={s.manual}>
        <Dots />
        Ждём файл в «Загрузках»
      </span>
    );
  }
  return (
    <span className={s.manual}>
      <Icon name="warn" size={15} />
      Нужна ручная загрузка
      <button className="btn sm" type="button" onClick={onOpen}>
        <Icon name="ext" size={15} />
        Открыть страницу
      </button>
    </span>
  );
}
