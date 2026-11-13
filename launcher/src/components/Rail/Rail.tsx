import { useEffect, useState, type ComponentProps } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Face } from '@components/Face/Face';
import { Icon } from '@components/Icon/Icon';
import { blockIcon } from '@components/Scene/pixels';
import { packStatus, useGame } from '@/context/Game';
import { useSession } from '@/context/Session';
import s from './Rail.module.scss';

type NavItem = { to: string; label: string; icon: ComponentProps<typeof Icon>['name']; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/mods', label: 'Моды', icon: 'cube' },
  { to: '/skin', label: 'Скин', icon: 'shirt' },
  { to: '/settings', label: 'Настройки', icon: 'gear' },
];

const ADMIN: NavItem = { to: '/admin', label: 'Админка', icon: 'shield' };

const ROLES = { admin: 'Администратор', user: 'Игрок', pending: 'Заявка на рассмотрении' };

export function Rail() {
  const { account, pending, logout } = useSession();
  const { packs, selected, select, run } = useGame();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (!account) return null;

  return (
    <aside className={s.rail}>
      <nav className={s.nav} aria-label="Разделы">
        {(account.role === 'admin' ? [...NAV, ADMIN] : NAV).map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={s.rbtn} data-tip={label} aria-label={label} draggable={false}>
            <Icon name={icon} size={22} />
            {to === ADMIN.to && pending > 0 && <span className={s.badge}>{pending}</span>}
          </NavLink>
        ))}
      </nav>
      {packs && packs.length > 1 ? (
        <>
          <div className={s.divider} />
          <div className={s.packs} aria-label="Сборки">
            {packs.map((info) => (
              <button
                key={info.pack.id}
                className={s.rpack}
                type="button"
                data-tip={info.pack.name}
                aria-label={info.pack.name}
                aria-current={info.pack.id === selected?.pack.id}
                onClick={() => {
                  select(info.pack.id);
                  navigate('/');
                }}
              >
                <img src={blockIcon(info.pack.theme)} alt="" />
                {packStatus(info) === 'update' && <span className={s.dot} />}
                {run?.packId === info.pack.id && (
                  <span className={s.progress}>
                    <i style={{ width: `${run.pct}%` }} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className={s.spacer} />
      )}
      <button
        className={s.avatar}
        type="button"
        aria-label={`Аккаунт ${account.name}`}
        aria-expanded={menu}
        onClick={(event) => {
          event.stopPropagation();
          setMenu(!menu);
        }}
      >
        <Face account={account} size={42} />
        <span className={s.online} />
      </button>
      {menu && (
        <div className={s.menu} role="menu" onClick={(event) => event.stopPropagation()}>
          <div className={s.who}>
            <Face account={account} size={40} />
            <div>
              <b>{account.name}</b>
              <div className="hint">{ROLES[account.role]}</div>
            </div>
          </div>
          <button type="button" role="menuitem" onClick={() => go('/skin')}>
            <Icon name="shirt" size={18} />
            Сменить скин
          </button>
          <button type="button" role="menuitem" onClick={() => go('/settings')}>
            <Icon name="gear" size={18} />
            Настройки
          </button>
          <button className={s.danger} type="button" role="menuitem" onClick={() => void logout()}>
            <Icon name="logout" size={18} />
            Выйти из аккаунта
          </button>
        </div>
      )}
    </aside>
  );

  function go(to: string) {
    setMenu(false);
    navigate(to);
  }
}
