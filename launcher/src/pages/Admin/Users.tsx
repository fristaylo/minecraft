import { ask } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState } from 'react';
import { Face } from '@components/Face/Face';
import { Icon } from '@components/Icon/Icon';
import { Blocks } from '@components/Loaders/Loaders';
import { deleteUser, errorText, listUsers, setRole, type AdminUser, type Role, type Skin } from '@/api';
import { useAccount, useSession } from '@/context/Session';
import { useToast } from '@/context/Toast';
import { useAttempt } from './attempt';
import { SkinModal } from './SkinModal';
import s from './Admin.module.scss';

const ROLES: [Role, string][] = [
  ['pending', 'Заявка'],
  ['user', 'Игрок'],
  ['admin', 'Админ'],
];

export function Users() {
  const toast = useToast();
  const attempt = useAttempt();
  const { id: selfId } = useAccount();
  const { refreshPending } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [skinUserId, setSkinUserId] = useState<AdminUser['id'] | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
    await refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="empty">
        <b>Не удалось загрузить игроков</b>
        <span>{error}</span>
        <button className="btn" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={16} />
          Повторить
        </button>
      </div>
    );
  }
  if (!users) {
    return (
      <div className="empty">
        <Blocks />
      </div>
    );
  }

  const requests = users.filter((user) => user.role === 'pending');
  const text = query.trim().toLowerCase();
  const skinUser = users.find((user) => user.id === skinUserId);
  const shown = users.filter((user) => user.name.toLowerCase().includes(text));

  function warn(warning: string | undefined) {
    if (warning) toast('Игровой сервер не ответил', warning, { kind: 'warn' });
  }

  async function changeRole(user: AdminUser, role: Role) {
    await attempt(async () => {
      warn((await setRole({ id: user.id, role })).warning);
      if (user.role === 'pending' && role !== 'pending') {
        toast(`${user.name} в whitelist`, 'Команда whitelist add ушла на игровой сервер через RCON.');
      } else if (role === 'pending') {
        toast(`${user.name} убран из whitelist`, 'Зайти на сервер не получится, пока заявку снова не примут.', { kind: 'warn' });
      } else {
        toast('Роль изменена', 'Вступит в силу при следующем входе игрока.');
      }
      await load();
    });
  }

  function changeSkin(id: AdminUser['id'], skin: Skin | null) {
    setUsers((current) => current && current.map((user) => (user.id === id ? { ...user, skin } : user)));
  }

  async function remove(user: AdminUser, declined: boolean) {
    if (!declined) {
      const confirmed = await ask(`Удалить игрока ${user.name}? Аккаунт и скин пропадут.`, {
        title: 'Удаление игрока',
        kind: 'warning',
        okLabel: 'Удалить',
        cancelLabel: 'Отмена',
      });
      if (!confirmed) return;
    }
    await attempt(async () => {
      warn((await deleteUser(user.id)).warning);
      toast(declined ? 'Заявка отклонена' : 'Игрок удалён', `Аккаунт ${user.name} удалён, ник снова свободен.`, { kind: 'info' });
      await load();
    });
  }

  return (
    <>
      {requests.length > 0 && (
        <div className={`panel ${s.req}`}>
          <div className="ph">
            <h3>
              Заявки <span className="cnt">{requests.length}</span>
            </h3>
            <span className="hint">Принятый игрок сразу попадает в whitelist игрового сервера</span>
          </div>
          <div className={s.reqs}>
            {requests.map((user) => (
              <div key={user.id} className={s.rq}>
                <Face account={{ name: user.name, skin: user.skin }} size={36} />
                <div className={s.rqMain}>
                  <b>{user.name}</b>
                  <span className={s.sub}>Регистрация: {formatDate(user.createdAt)}</span>
                </div>
                <button className="btn sm primary" type="button" onClick={() => void changeRole(user, 'user')}>
                  <Icon name="check" size={16} stroke={2.4} />
                  Принять
                </button>
                <button className="btn sm ghost" type="button" onClick={() => void remove(user, true)}>
                  Отклонить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={17} />
          <input
            className="inp"
            type="search"
            placeholder="Найти игрока по нику"
            aria-label="Найти игрока"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className={`panel scroll ${s.tblwrap}`}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Роль</th>
              <th>Whitelist</th>
              <th>Регистрация</th>
              <th>Последний вход</th>
              <th>Скин</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length ? (
              shown.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={s.cm}>
                      <Face account={{ name: user.name, skin: user.skin }} size={32} />
                      <b>{user.name}</b>
                    </div>
                  </td>
                  <td>
                    <select
                      className="inp"
                      aria-label={`Роль ${user.name}`}
                      value={user.role}
                      disabled={user.id === selfId}
                      onChange={(event) => void changeRole(user, event.target.value as Role)}
                    >
                      {ROLES.map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{user.whitelisted ? <span className="tag ok">Есть</span> : <span className="tag warn">Нет</span>}</td>
                  <td className="pct">{formatDate(user.createdAt)}</td>
                  <td className="hint">{user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}</td>
                  <td>{user.skin ? <span className="tag ok">Свой</span> : <span className="tag">Стандартный</span>}</td>
                  <td>
                    <div className={s.acts}>
                      <button className="btn ghost sm" type="button" aria-label={`Скин ${user.name}`} onClick={() => setSkinUserId(user.id)}>
                        <Icon name="shirt" size={16} />
                        Скин
                      </button>
                      <button
                        className="btn ghost icon sm"
                        type="button"
                        aria-label={`Удалить ${user.name}`}
                        disabled={user.id === selfId}
                        onClick={() => void remove(user, false)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="hint">
                  Игрок не найден
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {skinUser && <SkinModal user={skinUser} onChanged={(skin) => changeSkin(skinUser.id, skin)} onClose={() => setSkinUserId(null)} />}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
