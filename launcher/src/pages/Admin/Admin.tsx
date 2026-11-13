import { useState } from 'react';
import { useSession } from '@/context/Session';
import { Packs } from './Packs';
import { Users } from './Users';

type Tab = 'packs' | 'users';

const TABS: [Tab, string][] = [
  ['packs', 'Сборки'],
  ['users', 'Пользователи'],
];

export function Admin() {
  const { pending } = useSession();
  const [tab, setTab] = useState<Tab>('packs');

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Админка</h1>
          <p>
            {tab === 'packs'
              ? 'Соберите сборку, проверьте и опубликуйте. Игроки получат её при следующем запуске.'
              : 'Новые игроки приходят заявками. Принятые попадают в whitelist игрового сервера.'}
          </p>
        </div>
        <div className="pills" role="group" aria-label="Раздел админки">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
              {id === 'users' && pending > 0 && <span className="n">{pending}</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === 'packs' ? <Packs /> : <Users />}
    </>
  );
}
