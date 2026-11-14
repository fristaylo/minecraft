import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useState } from 'react';
import { Icon } from '@components/Icon/Icon';
import { Blocks, Dots } from '@components/Loaders/Loaders';
import { FileDrawer, ModDrawer } from '@components/ModDrawer/ModDrawer';
import {
  addConfigFiles,
  addLocalMod,
  addProject,
  adminDraft,
  adminSetOptional,
  applyUpdate,
  checkUpdates,
  deletePack,
  errorText,
  openManualDownload,
  projectDetails,
  removeEntry,
  setPackMeta,
  setPolicy,
  setSide,
  type AdminPack,
  type Kind,
  type Manifest,
  type ManifestFile,
  type ProjectDetails,
  type SearchItem,
  type Update,
} from '@/api';
import { useGame } from '@/context/Game';
import { useSettings } from '@/context/Settings';
import { useToast } from '@/context/Toast';
import { dependentsOf, fileName, fileTitle, formatLoader, instanceDir, modsWord } from '@/format';
import { useAttempt } from './attempt';
import { ConfigList, FilesTable, type ManualState } from './FilesTable';
import { Finder, formatDownloads } from './Finder';
import { MetaForm } from './MetaForm';
import { PublishBar } from './PublishBar';
import s from './Admin.module.scss';

type Opened =
  | { ctx: 'file'; path: ManifestFile['path'] }
  | { ctx: 'finder'; item: SearchItem; details: ProjectDetails | null; names: Record<string, Pick<SearchItem, 'title' | 'iconUrl'>> };

const TABS: [Kind, string][] = [
  ['mod', 'Моды'],
  ['config', 'Конфиги'],
  ['resourcepack', 'Ресурспаки'],
  ['shader', 'Шейдеры'],
];

export function PackEditor({
  pack,
  onSaved,
  onDeleted,
}: {
  pack: AdminPack;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const toast = useToast();
  const attempt = useAttempt();
  const [draft, setDraft] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminDraft(pack.id, false).then(setDraft, (e: unknown) => setError(errorText(e)));
  }, [pack.id]);

  return (
    <div className={s.editor}>
      {draft && pack.version && pack.version !== draft.version && (
        <div className={s.stale}>
          <span>
            Сборка обновлена до {pack.version}, черновик собран из {draft.version || 'пустой версии'}. Неопубликованные правки в черновике
            пропадут при загрузке свежей версии.
          </span>
          <button
            className="btn sm"
            type="button"
            onClick={() => void attempt(async () => setDraft(await adminDraft(pack.id, true)))}
          >
            <Icon name="refresh" size={16} />
            Загрузить свежую
          </button>
        </div>
      )}
      <MetaForm
        pack={pack}
        onSave={async (meta) => {
          setDraft(await setPackMeta(pack.id, meta));
          await onSaved();
          toast('Сборка сохранена', 'Изменения выйдут со следующей публикацией.');
        }}
        onDelete={async () => {
          await deletePack(pack.id);
          toast('Сборка удалена', pack.name, { kind: 'info' });
          await onDeleted();
        }}
      />
      {draft ? (
        <Content pack={pack} draft={draft} onDraft={setDraft} onSaved={onSaved} />
      ) : (
        <div className="empty">{error ? <b>Не удалось загрузить черновик: {error}</b> : <Blocks />}</div>
      )}
    </div>
  );
}

function Content({
  pack,
  draft,
  onDraft,
  onSaved,
}: {
  pack: AdminPack;
  draft: Manifest;
  onDraft: (draft: Manifest) => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const attempt = useAttempt();
  const { packs } = useGame();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Kind>('mod');
  const [opened, setOpened] = useState<Opened | null>(null);
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [busy, setBusy] = useState<'check' | 'update' | null>(null);
  const [manual, setManual] = useState<Record<ManifestFile['path'], ManualState>>({});
  const published = packs?.find((info) => info.pack.id === pack.id)?.manifest;

  useEffect(() => {
    const subscription = listen<{ path: ManifestFile['path'] }>('admin://manual-found', ({ payload }) => {
      setManual((current) => ({ ...current, [payload.path]: 'ok' }));
      toast('Файл найден', `${fileName(payload.path)}: хеш совпал, файл загрузится на сервер при публикации.`);
    });
    return () => void subscription.then((unlisten) => unlisten());
  }, [toast]);

  const target = `${draft.minecraft} ${formatLoader(draft.loader)}`;
  const files = draft.files.filter((file) => file.kind === tab);
  const opener = opened?.ctx === 'file' ? draft.files.find((file) => file.path === opened.path) : undefined;
  const edit = (action: () => Promise<Manifest>) => attempt(async () => onDraft(await action()));

  async function add(item: SearchItem) {
    await attempt(async () => {
      const outcome = await addProject({ packId: pack.id, source: item.source, projectId: item.id, kind: tab });
      onDraft(outcome.draft);
      setOpened(null);
      const blocked = outcome.draft.files.some((file) => file.meta?.projectId === item.id && file.meta.source === 'manual');
      const extras = outcome.added.filter((title) => title !== item.title);
      toast(
        `Добавлен ${item.title}`,
        blocked
          ? 'Автор запретил стороннее скачивание: скачайте файл вручную, он попадёт на сервер при публикации.'
          : extras.length
            ? `Вместе с зависимостями: ${extras.join(', ')}.`
            : 'Зависимостей нет.',
        { kind: blocked ? 'warn' : 'ok' },
      );
      if (outcome.incompatible.length) {
        toast('Не нашлось подходящих версий', `${outcome.incompatible.join(', ')}: нет версии для ${target}. Добавьте вручную.`, { kind: 'warn' });
      }
    });
  }

  async function remove(file: ManifestFile) {
    const users = dependentsOf(draft.files, file);
    if (users.length) {
      toast(`${fileTitle(file)} нужен другим модам`, `Сначала уберите: ${users.map(fileTitle).join(', ')}.`, { kind: 'warn' });
      return;
    }
    await attempt(async () => {
      onDraft(await removeEntry({ packId: pack.id, path: file.path }));
      setOpened(null);
      toast(`${fileTitle(file)} убран из сборки`, 'У игроков он удалится при следующем запуске.', { kind: 'info' });
    });
  }

  async function check() {
    setBusy('check');
    await attempt(async () => {
      const found = await checkUpdates(pack.id);
      setUpdates(found);
      toast(found.length ? `Найдено обновлений: ${found.length}` : 'Все моды актуальны', found.length ? `Только версии под ${target}.` : '');
    });
    setBusy(null);
  }

  async function update(paths: ManifestFile['path'][]) {
    setBusy('update');
    await attempt(async () => {
      for (const path of paths) {
        const outcome = await applyUpdate({ packId: pack.id, path });
        onDraft(outcome.draft);
        setUpdates((list) => list && list.filter((item) => item.path !== path));
        if (outcome.incompatible.length) {
          toast('Не нашлось подходящих версий', `${outcome.incompatible.join(', ')}: нет версии для ${target}.`, { kind: 'warn' });
        }
      }
      toast('Моды обновлены', 'Изменения войдут в следующую публикацию.');
    });
    setBusy(null);
  }

  async function manualDownload(path: ManifestFile['path']) {
    await attempt(async () => {
      await openManualDownload({ packId: pack.id, path });
      setManual((current) => ({ ...current, [path]: 'wait' }));
      toast('Страница мода открыта в браузере', 'Нажмите Download, лаунчер сам найдёт файл в папке «Загрузки».', { kind: 'info' });
    });
  }

  async function addConfigs() {
    const root = instanceDir(settings.game_dir, pack.id);
    await attempt(async () => {
      const picked = await open({ multiple: true, defaultPath: root });
      if (!picked) return;
      const prefix = `${root.replaceAll('\\', '/')}/`.toLowerCase();
      const paths = picked.map((path) => path.replaceAll('\\', '/'));
      const inside = paths.filter((path) => path.toLowerCase().startsWith(prefix));
      if (inside.length !== paths.length) toast('Файлы должны лежать в папке сборки', root, { kind: 'warn' });
      if (inside.length) {
        onDraft(await addConfigFiles({ packId: pack.id, root, paths: inside.map((path) => path.slice(prefix.length)), policy: 'once' }));
      }
    });
  }

  async function addLocal() {
    await attempt(async () => {
      const picked = await open({ filters: [{ name: 'Fabric mod', extensions: ['jar'] }] });
      if (!picked) return;
      onDraft(await addLocalMod({ packId: pack.id, path: picked }));
      toast('Мод добавлен', 'Файл загрузится на сервер при публикации.');
    });
  }

  async function openFinder(item: SearchItem) {
    setOpened({ ctx: 'finder', item, details: null, names: {} });
    await attempt(async () => {
      const details = await projectDetails(item);
      const missing = pickVersion(details, draft)?.dependencies.filter(
        ({ projectId, required }) => required && !draft.files.some((file) => file.meta?.projectId === projectId),
      );
      const loaded = await Promise.all(
        (missing ?? []).map(({ projectId }) =>
          projectDetails({ source: item.source, id: projectId }).then(
            ({ project }) => [projectId, { title: project.title, iconUrl: project.iconUrl }] as const,
            () => null,
          ),
        ),
      );
      const names = Object.fromEntries(loaded.filter((entry) => entry !== null));
      setOpened((current) => (current?.ctx === 'finder' && current.item.id === item.id ? { ...current, details, names } : current));
    });
  }

  return (
    <>
      <div className={s.tabsline} role="tablist">
        {TABS.map(([kind, label]) => (
          <button key={kind} type="button" role="tab" aria-selected={tab === kind} onClick={() => setTab(kind)}>
            {label}
            <span className="n">{draft.files.filter((file) => file.kind === kind).length}</span>
          </button>
        ))}
      </div>
      {tab === 'config' ? (
        <>
          <div className="toolbar">
            <span className={`hint ${s.grow}`}>
              Файлы из папки сборки, которые получат игроки. «Только если игрок не менял» сохранит личные настройки.
            </span>
            <button className="btn sm" type="button" onClick={() => void addConfigs()}>
              <Icon name="plus" size={16} />
              Добавить файлы
            </button>
          </div>
          <ConfigList
            files={files}
            onPolicy={(file, policy) => void edit(() => setPolicy({ packId: pack.id, path: file.path, policy }))}
            onRemove={(file) => void remove(file)}
          />
        </>
      ) : (
        <>
          <Finder
            key={tab}
            draft={draft}
            kind={tab}
            files={draft.files}
            onAdd={add}
            onOpen={(item) => void openFinder(item)}
          />
          {tab === 'mod' && (
            <div className="toolbar">
              <span className={`hint ${s.grow}`}>
                {modsWord(files.length)} · подобраны под {target}
              </span>
              {updates && updates.length > 0 && (
                <button className="btn sm gold" type="button" disabled={busy !== null} onClick={() => void update(updates.map(({ path }) => path))}>
                  <Icon name="download" size={16} stroke={2.2} />
                  Обновить все ({updates.length})
                </button>
              )}
              <button className="btn sm" type="button" onClick={() => void addLocal()}>
                <Icon name="plus" size={16} />
                Добавить свой мод (.jar)
              </button>
              <button className="btn sm" type="button" disabled={busy !== null} onClick={() => void check()}>
                {busy === 'check' ? (
                  <>
                    <Dots />
                    Проверяем
                  </>
                ) : (
                  <>
                    <Icon name="refresh" size={16} />
                    Проверить обновления
                  </>
                )}
              </button>
            </div>
          )}
          {files.length ? (
            <FilesTable
              kind={tab}
              files={files}
              all={draft.files}
              updates={updates}
              manual={manual}
              busy={busy !== null}
              onOpen={(path) => setOpened({ ctx: 'file', path })}
              onSide={(file, side) => void edit(() => setSide({ packId: pack.id, path: file.path, side }))}
              onOptional={(file, optional) =>
                void edit(() => adminSetOptional({ packId: pack.id, path: file.path, optional, defaultEnabled: file.defaultEnabled }))
              }
              onRemove={(file) => void remove(file)}
              onUpdate={(path) => void update([path])}
              onManual={(path) => void manualDownload(path)}
            />
          ) : (
            <div className="panel">
              <div className="empty">
                <b>Пока пусто</b>
                <span>Найдите нужное выше через поиск.</span>
              </div>
            </div>
          )}
        </>
      )}
      <PublishBar
        pack={pack}
        draft={draft}
        changes={countChanges(draft, published)}
        onPublished={(version) => onDraft({ ...draft, version })}
        onSettled={onSaved}
      />
      {opener?.meta && (
        <FileDrawer
          files={draft.files}
          file={{ ...opener, meta: opener.meta }}
          userTag={(user) => (user.optional ? 'опциональный' : 'обязательный')}
          onOpen={(path) => setOpened({ ctx: 'file', path })}
          onClose={() => setOpened(null)}
        >
          <button className="btn danger" type="button" disabled={dependentsOf(draft.files, opener).length > 0} onClick={() => void remove(opener)}>
            <Icon name="trash" size={17} />
            Убрать из сборки
          </button>
          {dependentsOf(draft.files, opener).length > 0 && <span className="hint">Нужен модам выше, убрать нельзя</span>}
        </FileDrawer>
      )}
      {opened?.ctx === 'finder' && (
        <FinderDrawer
          opened={opened}
          draft={draft}
          target={target}
          onOpenFile={(path) => setOpened({ ctx: 'file', path })}
          onAdd={add}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}

function FinderDrawer({
  opened: { item, details, names },
  draft,
  target,
  onOpenFile,
  onAdd,
  onClose,
}: {
  opened: Extract<Opened, { ctx: 'finder' }>;
  draft: Manifest;
  target: string;
  onOpenFile: (path: ManifestFile['path']) => void;
  onAdd: (item: SearchItem) => Promise<void>;
  onClose: () => void;
}) {
  const inPack = draft.files.some((file) => file.meta?.projectId === item.id);
  const version = details && pickVersion(details, draft);

  return (
    <ModDrawer
      meta={{
        title: item.title,
        iconUrl: item.iconUrl,
        description: item.description,
        gallery: details?.project.gallery ?? [],
        pageUrl: details?.project.pageUrl ?? '',
        source: item.source,
      }}
      subtitle={`${item.author} · ${formatDownloads(item.downloads)} загрузок`}
      tags={[item.compatible ? `Есть версия для ${target}` : `Нет версии для ${target}`]}
      deps={(version?.dependencies ?? [])
        .filter(({ required }) => required)
        .map(({ projectId }) => {
          const file = draft.files.find((candidate) => candidate.meta?.projectId === projectId);
          return {
            key: projectId,
            title: file ? fileTitle(file) : (names[projectId]?.title ?? projectId),
            iconUrl: file?.meta?.iconUrl ?? names[projectId]?.iconUrl ?? '',
            right: <span className={`tag ${file ? 'ok' : 'warn'}`}>{file ? 'В сборке' : 'Добавится сам'}</span>,
            onOpen: file && (() => onOpenFile(file.path)),
          };
        })}
      users={draft.files
        .filter((file) => file.meta?.dependencies.includes(item.id))
        .map((file) => ({
          key: file.path,
          title: fileTitle(file),
          iconUrl: file.meta?.iconUrl ?? '',
          right: <span className="tag">{file.optional ? 'опциональный' : 'обязательный'}</span>,
          onOpen: () => onOpenFile(file.path),
        }))}
      usersHint="В сборке нет модов, которым он нужен."
      onClose={onClose}
    >
      {inPack ? (
        <span className="tag ok">Уже в сборке</span>
      ) : (
        <button className="btn primary" type="button" disabled={!item.compatible} onClick={() => void onAdd(item)}>
          <Icon name="plus" size={17} stroke={2.2} />
          Добавить в сборку
        </button>
      )}
    </ModDrawer>
  );
}

function pickVersion({ versions }: ProjectDetails, { minecraft, loader }: Pick<Manifest, 'minecraft' | 'loader'>) {
  return versions.find((v) => v.gameVersions.includes(minecraft) && v.loaders.includes(loader.type)) ?? versions[0];
}

function countChanges(draft: Manifest, published: Manifest | undefined): number {
  if (!published) return Math.max(1, draft.files.length);
  const before = new Map(published.files.map((file) => [file.path, file]));
  const changed = draft.files.filter((file) => {
    const old = before.get(file.path);
    return (
      !old ||
      old.sha1 !== file.sha1 ||
      old.side !== file.side ||
      old.optional !== file.optional ||
      old.defaultEnabled !== file.defaultEnabled ||
      old.policy !== file.policy
    );
  });
  const removed = published.files.filter((file) => !draft.files.some((other) => other.path === file.path));
  const meta =
    draft.name !== published.name ||
    draft.theme !== published.theme ||
    draft.minecraft !== published.minecraft ||
    draft.loader.type !== published.loader.type ||
    (draft.loader.version ?? '') !== (published.loader.version ?? '') ||
    draft.java !== published.java ||
    (draft.server ?? '') !== (published.server ?? '');
  return changed.length + removed.length + (meta ? 1 : 0);
}
