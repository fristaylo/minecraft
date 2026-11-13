import { useState, type FormEvent } from 'react';
import { Dots } from '@components/Loaders/Loaders';
import { Icon } from '@components/Icon/Icon';
import { Scene } from '@components/Scene/Scene';
import { errorText, login, register } from '@/api';
import { useGame } from '@/context/Game';
import { useSession } from '@/context/Session';
import { useToast } from '@/context/Toast';
import s from './Login.module.scss';

export function Login() {
  const { setAccount } = useSession();
  const { status } = useGame();
  const toast = useToast();
  const [registering, setRegistering] = useState(false);
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validate(nick.trim(), pass, registering ? repeat : pass);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      setAccount(await (registering ? register : login)(nick.trim(), pass));
      if (registering) {
        toast('Заявка отправлена', 'Админ добавит вас в whitelist сервера. Пока можно выбрать скин и настроить игру.', { kind: 'info', icon: 'clock' });
      }
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className={s.login}>
      <div className={s.art}>
        <Scene className={s.canvas} theme="dawn" seed="login" width={230} height={200} animated />
        <div className={s.cap}>
          <span className="badge">
            <span className="ldot" />
            {__API_HOST__}
            {status?.online && ` · ${status.players.online} онлайн`}
          </span>
          <h2>
            Сервер ждёт.
            <br />
            Скин, сборка и моды подтянутся сами.
          </h2>
        </div>
      </div>
      <div className={s.side}>
        <form className={s.card} onSubmit={(event) => void submit(event)} noValidate>
          <div>
            <h1>{registering ? 'Новый аккаунт' : 'Вход'}</h1>
            <p className={s.lead}>
              {registering
                ? 'Ник станет именем в игре, сменить его нельзя. Играть на сервере можно после одобрения заявки админом.'
                : 'Войдите, чтобы играть на сервере со своим скином.'}
            </p>
          </div>
          <div className="pills wide" role="group" aria-label="Вход или регистрация">
            <button type="button" aria-pressed={!registering} onClick={() => switchMode(false)}>
              Вход
            </button>
            <button type="button" aria-pressed={registering} onClick={() => switchMode(true)}>
              Регистрация
            </button>
          </div>
          <label className="fld">
            <span>Ник</span>
            <input className="inp" autoComplete="username" placeholder="например, stone_wolf" value={nick} onChange={(e) => setNick(e.target.value)} />
          </label>
          <label className="fld">
            <span>Пароль</span>
            <input className="inp" type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {registering && (
            <label className="fld">
              <span>Повторите пароль</span>
              <input className="inp" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
          )}
          {error && (
            <p className={s.error}>
              <Icon name="warn" size={16} />
              {error}
            </p>
          )}
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? (
              <>
                <Dots />
                {registering ? 'Создаём аккаунт' : 'Входим'}
              </>
            ) : registering ? (
              'Создать аккаунт'
            ) : (
              'Войти'
            )}
          </button>
          <p className="hint">Ник: от 3 до 16 символов, латиница, цифры и «_».</p>
        </form>
      </div>
    </div>
  );

  function switchMode(next: boolean) {
    setRegistering(next);
    setError('');
  }
}

function validate(nick: string, pass: string, repeat: string): string {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) return 'Ник должен быть от 3 до 16 символов: латиница, цифры и «_».';
  if (pass.length < 6) return 'Пароль короче 6 символов.';
  if (repeat !== pass) return 'Пароли не совпадают.';
  return '';
}
