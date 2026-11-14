import { useState } from 'react';
import { useSession } from '@/context/Session';
import { Packs } from './Packs';
import { Skins } from './Skins';
import { Users } from './Users';

type Tab = keyof typeof SUBTITLES;

const SUBTITLES = {
  packs: 'Соберите сборку, проверьте и опубликуйте. Игроки получат её при следующем запуске.',
  users: 'Новые игроки приходят заявками. Принятые попадают в whitelist игрового сервера.',
  skins: 'Каталог скинов для игроков: импорт из MineSkin, по нику Mojang или своим PNG.',
};

const TABS: [Tab, string][] = [
  ['packs', 'Сборки'],
  ['users', 'Пользователи'],
  ['skins', 'Скины'],
];

export function Admin() {
  const { pending } = useSession();
  const [tab, setTab] = useState<Tab>('packs');

  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ph-title">Админка</h1>
          <p>{SUBTITLES[tab]}</p>
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
      {tab === 'packs' && <Packs />}
      {tab === 'users' && <Users />}
      {tab === 'skins' && <Skins />}
    </>
  );
}
