import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@components/Icon/Icon';
import { ModIcon } from '@components/ModIcon/ModIcon';
import { SourceTag, sourceLabel } from '@components/SourceTag/SourceTag';
import { errorText, type ManifestFile, type Meta } from '@/api';
import { useToast } from '@/context/Toast';
import { dependenciesOf, dependentsOf, fileTitle, formatFileSize, SIDES } from '@/format';
import s from './ModDrawer.module.scss';

export type DrawerLink = { key: string; title: string; iconUrl: string; right: ReactNode; onOpen?: () => void };

export function ModDrawer({
  meta,
  subtitle,
  tags,
  deps,
  users,
  usersHint,
  onClose,
  children,
}: {
  meta: Pick<Meta, 'title' | 'iconUrl' | 'description' | 'gallery' | 'pageUrl' | 'source'>;
  subtitle: string;
  tags: string[];
  deps: DrawerLink[];
  users: DrawerLink[];
  usersHint: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const toast = useToast();
  const [shot, setShot] = useState(0);
  const { gallery } = meta;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className={s.bg} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={meta.title}>
        <div className={s.head}>
          <ModIcon iconUrl={meta.iconUrl} size={40} />
          <div className={s.titles}>
            <b className={s.title}>{meta.title}</b>
            <div className={s.sub}>{subtitle}</div>
          </div>
          <button className="btn ghost icon" type="button" aria-label="Закрыть" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className={`${s.body} scroll`}>
          {gallery.length > 0 && (
            <>
              <div className={s.shot}>
                <img src={gallery[shot]} alt="" />
                <span className={`badge sm ${s.shotN}`}>
                  {shot + 1} из {gallery.length}
                </span>
              </div>
              {gallery.length > 1 && (
                <div className={s.thumbs}>
                  {gallery.slice(0, 4).map((url, i) => (
                    <button key={url} type="button" aria-pressed={i === shot} aria-label={`Скриншот ${i + 1}`} onClick={() => setShot(i)}>
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className={s.tags}>
            <SourceTag source={meta.source} />
            {tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <p className={s.desc}>{meta.description || 'Описание подтянется со страницы мода.'}</p>
          <Section title="Зависимости" links={deps} empty="Работает без других модов." />
          <Section title="Зависят от него" links={users} empty={usersHint} />
        </div>
        <div className={s.foot}>
          <button
            className="btn"
            type="button"
            disabled={!meta.pageUrl}
            onClick={() => openUrl(meta.pageUrl).catch((error: unknown) => toast('Не удалось открыть страницу', errorText(error), { kind: 'warn' }))}
          >
            <Icon name="ext" size={17} />
            {sourceLabel(meta.source)}
          </button>
          {children}
        </div>
      </aside>
    </>,
    document.getElementById('root')!,
  );
}

export function FileDrawer({
  files,
  file,
  userTag,
  onOpen,
  onClose,
  children,
}: {
  files: ManifestFile[];
  file: ManifestFile & { meta: Meta };
  userTag: (user: ManifestFile) => string;
  onOpen: (path: ManifestFile['path']) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { meta } = file;
  return (
    <ModDrawer
      meta={meta}
      subtitle={meta.author}
      tags={[SIDES[file.side], formatFileSize(file.size), file.optional ? 'Опционально' : 'Обязательный']}
      deps={dependenciesOf(files, file).map((dep) => ({
        key: dep.path,
        title: fileTitle(dep),
        iconUrl: dep.meta?.iconUrl ?? '',
        right: <span className="tag ok">В сборке</span>,
        onOpen: () => onOpen(dep.path),
      }))}
      users={dependentsOf(files, file).map((user) => ({
        key: user.path,
        title: fileTitle(user),
        iconUrl: user.meta?.iconUrl ?? '',
        right: <span className="tag">{userTag(user)}</span>,
        onOpen: () => onOpen(user.path),
      }))}
      usersHint="Ни один мод сборки его не требует."
      onClose={onClose}
    >
      {children}
    </ModDrawer>
  );
}

function Section({ title, links, empty }: { title: string; links: DrawerLink[]; empty: string }) {
  return (
    <section>
      <h4 className={s.sec}>
        {title} <span className="cnt">{links.length}</span>
      </h4>
      {links.length ? (
        <div className={s.list}>
          {links.map(({ key, title: name, iconUrl, right, onOpen }) => {
            const content = (
              <>
                <ModIcon iconUrl={iconUrl} size={28} />
                <span>{name}</span>
                {right}
              </>
            );
            return onOpen ? (
              <button key={key} className={s.item} type="button" onClick={onOpen}>
                {content}
              </button>
            ) : (
              <div key={key} className={s.item}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="hint">{empty}</p>
      )}
    </section>
  );
}
