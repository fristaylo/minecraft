import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useState } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { ModelPicker } from '@components/ModelPicker/ModelPicker';
import { SkinCatalog } from '@components/SkinCatalog/SkinCatalog';
import { useCatalog } from '@components/SkinSources/SkinSources';
import { SkinViewer } from '@components/SkinViewer/SkinViewer';
import { errorText, resetSkin, setCatalogSkin, uploadSkin, type CatalogSkin, type Me, type SkinModel } from '@/api';
import { useAccount, useSession } from '@/context/Session';
import { useToast } from '@/context/Toast';
import { pathName } from '@/format';
import s from './Skin.module.scss';

export function Skin() {
  const account = useAccount();
  const { setAccount } = useSession();
  const toast = useToast();
  const [model, setModel] = useState<SkinModel>(account.skin?.model ?? 'classic');
  const [file, setFile] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<'save' | 'reset' | 'apply' | null>(null);
  const [catalog] = useCatalog();
  const [preview, setPreview] = useState<CatalogSkin | null>(null);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      setOver(payload.type === 'enter' || payload.type === 'over');
      if (payload.type !== 'drop') return;
      const png = payload.paths.find((path) => /\.png$/i.test(path));
      if (png) setFile(png);
      else toast('Нужен PNG-файл', 'Скин должен быть картинкой в формате PNG.', { kind: 'warn' });
    });
    return () => void unlisten.then((stop) => stop());
  }, [toast]);

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Скин</h1>
          <p>Скин хранится на сервере аккаунтов. Изменения сразу видны всем игрокам на сервере.</p>
        </div>
      </div>
      <div className={s.grid}>
        <SkinViewer name={account.name} skin={preview ?? account.skin} model={preview?.model ?? model} />
        <div className={s.stack}>
          <div className="panel">
            <h3>Модель</h3>
            <ModelPicker value={model} onChange={setModel} />
          </div>
          <div className="panel">
            <h3>Каталог</h3>
            {catalog ? (
              <SkinCatalog items={catalog} itemKey={(item) => item.id} selected={preview?.id ?? null} empty="Каталог пока пуст" onSelect={setPreview} />
            ) : (
              <p className="hint">Загружаем каталог</p>
            )}
          </div>
          <div className="panel">
            <h3>Свой скин</h3>
            <button className={`${s.drop} ${over ? s.over : ''}`} type="button" onClick={() => void choose()}>
              <span className={s.dropIcon}>
                <Icon name={file ? 'check' : 'upload'} size={20} />
              </span>
              <span>
                <b>{file ? pathName(file) : 'Перетащите PNG или выберите файл'}</b>
                {file ? 'Нажмите «Сохранить скин», чтобы загрузить его на сервер' : 'Размер 64×64 или 64×32 пикселя'}
              </span>
            </button>
          </div>
          <div className={s.actions}>
            <button className="btn primary" type="button" disabled={!preview || busy !== null} onClick={() => void apply(preview)}>
              {busy === 'apply' ? (
                <>
                  <Dots />
                  Применяем
                </>
              ) : (
                <>
                  <Icon name="check" size={18} stroke={2.2} />
                  Применить из каталога
                </>
              )}
            </button>
            <button className="btn primary" type="button" disabled={!file || busy !== null} onClick={() => void save()}>
              {busy === 'save' ? (
                <>
                  <Dots />
                  Сохраняем
                </>
              ) : (
                <>
                  <Icon name="check" size={18} stroke={2.2} />
                  Сохранить скин
                </>
              )}
            </button>
            <button className="btn ghost" type="button" disabled={!account.skin || busy !== null} onClick={() => void reset()}>
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </>
  );

  async function choose() {
    try {
      const path = await open({ filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (typeof path === 'string') setFile(path);
    } catch (error) {
      toast('Не удалось открыть выбор файла', errorText(error), { kind: 'warn' });
    }
  }

  async function apply(item: CatalogSkin | null) {
    if (!item) return;
    await run('apply', () => setCatalogSkin(item.id), 'Скин применён', 'Скин обновлён для всех игроков на сервере сразу.');
  }

  async function save() {
    if (!file) return;
    await run('save', () => uploadSkin(file, model), 'Скин сохранён', 'Скин обновлён для всех игроков на сервере сразу.');
    setFile(null);
  }

  async function reset() {
    await run('reset', resetSkin, 'Скин сброшен', 'Снова используется стандартный скин.');
  }

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<Me>, title: string, desc: string) {
    setBusy(kind);
    try {
      const me = await action();
      setAccount(me);
      setModel(me.skin?.model ?? model);
      setPreview(null);
      toast(title, desc);
    } catch (error) {
      toast('Не удалось изменить скин', errorText(error), { kind: 'warn' });
    }
    setBusy(null);
  }
}
