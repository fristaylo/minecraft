import { useState } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { Modal } from '@components/Modal/Modal';
import { SkinSources, importArgs, previewOf, useCatalog, type Picked } from '@components/SkinSources/SkinSources';
import { SkinViewer } from '@components/SkinViewer/SkinViewer';
import { errorText, resetUserSkin, setUserSkinCatalog, setUserSkinFile, setUserSkinImport, type AdminUser, type Skin } from '@/api';
import { useToast } from '@/context/Toast';
import s from './Admin.module.scss';

export function SkinModal({ user, onChanged, onClose }: { user: AdminUser; onChanged: (skin: Skin | null) => void; onClose: () => void }) {
  const toast = useToast();
  const [catalog] = useCatalog();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState<'apply' | 'reset' | null>(null);
  const skin = previewOf(picked) ?? user.skin;

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<Skin | null>, title: string) {
    setBusy(kind);
    try {
      onChanged(await action());
      toast(title, `Скин игрока ${user.name} на сервере обновится сразу.`);
      onClose();
    } catch (error) {
      toast('Не удалось изменить скин', errorText(error), { kind: 'warn' });
      setBusy(null);
    }
  }

  return (
    <Modal title={`Скин игрока ${user.name}`} onClose={onClose}>
      <div className={s.skinGrid}>
        <SkinViewer name={user.name} skin={skin} model={picked?.kind === 'file' ? picked.model : (skin?.model ?? 'classic')} minHeight={340} />
        <div className={s.skinSide}>
          <SkinSources catalog={catalog} picked={picked} onPick={setPicked} />
          <div className={s.skinActions}>
            <button className="btn primary" type="button" disabled={!picked || busy !== null} onClick={() => picked && void run('apply', () => applySkin(user.id, picked), 'Скин применён')}>
              {busy === 'apply' ? (
                <>
                  <Dots />
                  Применяем
                </>
              ) : (
                <>
                  <Icon name="check" size={18} stroke={2.2} />
                  Применить
                </>
              )}
            </button>
            <button className="btn ghost" type="button" disabled={!user.skin || busy !== null} onClick={() => void run('reset', () => resetUserSkin(user.id).then(() => null), 'Скин сброшен')}>
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function applySkin(id: AdminUser['id'], picked: Picked): Promise<Skin> {
  if (picked.kind === 'catalog') return setUserSkinCatalog({ id, skinId: picked.skin.id });
  if (picked.kind === 'import') return setUserSkinImport({ id, ...importArgs(picked) });
  return setUserSkinFile({ id, path: picked.path, model: picked.model });
}
