import { ask } from '@tauri-apps/plugin-dialog';
import { useState, type ComponentProps } from 'react';
import { Icon } from '@components/Icon/Icon';
import type { AdminPack, LoaderType, PackMeta, Theme } from '@/api';
import { LOADERS } from '@/format';
import { useAttempt } from './attempt';
import s from './Admin.module.scss';

type Form = Pick<AdminPack, 'id' | 'name' | 'theme' | 'minecraft' | 'loaderType' | 'gameServer'> & {
  loaderVersion: string;
  java: string;
  server: string;
};

type TextKey = 'id' | 'name' | 'minecraft' | 'loaderVersion' | 'java' | 'server';

const THEMES: Record<Theme, string> = {
  day: 'День',
  dusk: 'Сумерки',
  night: 'Ночь',
  dawn: 'Рассвет',
  snow: 'Снег',
  desert: 'Пустыня',
  nether: 'Незер',
  end: 'Край',
};

export function MetaForm({
  pack,
  onSave,
  onDelete,
}: {
  pack?: AdminPack;
  onSave: (meta: PackMeta, id: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const attempt = useAttempt();
  const initial = toForm(pack);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const vanilla = form.loaderType === 'vanilla';
  const java = Number(form.java);
  const valid =
    (pack !== undefined || /^[a-z0-9][a-z0-9-]{0,31}$/.test(form.id)) &&
    form.name.trim() !== '' &&
    form.minecraft.trim() !== '' &&
    Number.isInteger(java) &&
    java > 0 &&
    (vanilla || form.loaderVersion.trim() !== '');
  const dirty = pack === undefined || (Object.keys(form) as (keyof Form)[]).some((key) => form[key] !== initial[key]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function field(key: TextKey) {
    return { value: form[key], onChange: (value: string) => set(key, value) };
  }

  async function save() {
    setBusy(true);
    await attempt(() =>
      onSave(
        {
          name: form.name.trim(),
          theme: form.theme,
          minecraft: form.minecraft.trim(),
          loaderType: form.loaderType,
          loaderVersion: vanilla ? undefined : form.loaderVersion.trim(),
          java,
          server: form.server.trim() || undefined,
          gameServer: form.gameServer,
        },
        form.id,
      ),
    );
    setBusy(false);
  }

  async function remove() {
    const confirmed = await ask(`Удалить сборку «${form.name}»? Опубликованные версии тоже пропадут.`, {
      title: 'Удаление сборки',
      kind: 'warning',
      okLabel: 'Удалить',
      cancelLabel: 'Отмена',
    });
    if (confirmed && onDelete) await attempt(onDelete);
  }

  return (
    <div className="panel">
      <div className={s.formGrid}>
        {pack === undefined && (
          <Input label="Идентификатор" placeholder="латиницей, например survival" {...field('id')} />
        )}
        <Input label="Название" {...field('name')} />
        <Input label="Версия Minecraft" {...field('minecraft')} />
        <label className="fld">
          <span>Загрузчик</span>
          <select className="inp" value={form.loaderType} onChange={(event) => set('loaderType', event.target.value as LoaderType)}>
            {(Object.keys(LOADERS) as LoaderType[]).map((type) => (
              <option key={type} value={type}>
                {LOADERS[type]}
              </option>
            ))}
          </select>
        </label>
        <Input label="Версия загрузчика" disabled={vanilla} {...field('loaderVersion')} />
        <Input label="Java" type="number" {...field('java')} />
        <label className="fld">
          <span>Тема</span>
          <select className="inp" value={form.theme} onChange={(event) => set('theme', event.target.value as Theme)}>
            {(Object.keys(THEMES) as Theme[]).map((theme) => (
              <option key={theme} value={theme}>
                {THEMES[theme]}
              </option>
            ))}
          </select>
        </label>
        <Input label="Адрес сервера" placeholder="не задан" {...field('server')} />
        <label className={`check ${s.gameServer}`}>
          <input className="sw" type="checkbox" checked={form.gameServer} onChange={(event) => set('gameServer', event.target.checked)} />
          Игровой сервер на этом хосте
        </label>
      </div>
      <div className={s.formActions}>
        <button className="btn primary sm" type="button" disabled={!valid || !dirty || busy} onClick={() => void save()}>
          <Icon name="check" size={16} stroke={2.2} />
          {pack ? 'Сохранить' : 'Создать сборку'}
        </button>
        {onDelete && (
          <button className="btn danger sm" type="button" onClick={() => void remove()}>
            <Icon name="trash" size={16} />
            Удалить сборку
          </button>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  ...props
}: { label: string; value: string; onChange: (value: string) => void } & Pick<ComponentProps<'input'>, 'type' | 'disabled' | 'placeholder'>) {
  return (
    <label className="fld">
      <span>{label}</span>
      <input className="inp" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function toForm(pack: AdminPack | undefined): Form {
  return {
    id: pack?.id ?? '',
    name: pack?.name ?? '',
    theme: pack?.theme ?? 'day',
    minecraft: pack?.minecraft ?? '1.21.1',
    loaderType: pack?.loaderType ?? 'fabric',
    loaderVersion: pack?.loaderVersion ?? '',
    java: String(pack?.java ?? 21),
    server: pack?.server ?? '',
    gameServer: pack?.gameServer ?? false,
  };
}
