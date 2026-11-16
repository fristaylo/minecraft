import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Blocks } from '@components/Loaders/Loaders';
import { Rail } from '@components/Rail/Rail';
import { FloatingTitlebar, Titlebar } from '@components/Titlebar/Titlebar';
import { UpdateInstall, UpdateProgressBar, useUpdateInstall } from '@components/UpdateInstall/UpdateInstall';
import { Login } from '@pages/Login/Login';
import { checkUpdate, type UpdateProgress } from '@/api';
import { useSession } from '@/context/Session';
import { useSettings } from '@/context/Settings';
import { useToast } from '@/context/Toast';
import s from './Shell.module.scss';

const POLL_INTERVAL = 30 * 60 * 1000;

export function Shell() {
  const { account } = useSession();
  const toast = useToast();
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const main = useRef<HTMLElement>(null);
  const notified = useRef<string>(undefined);
  const [version, setVersion] = useState<string>();
  const { progress, install } = useUpdateInstall();

  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let first = true;
    function check() {
      const auto = first && settings.auto_update;
      first = false;
      checkUpdate()
        .then((update) => {
          if (!update || notified.current === update.version) return;
          notified.current = update.version;
          if (auto) {
            setVersion(update.version);
            void install();
            return;
          }
          toast(`Доступна версия ${update.version}`, update.notes ?? '', {
            kind: 'info',
            icon: 'download',
            sticky: true,
            body: (close) => <UpdateInstall onLater={close} />,
          });
        })
        .catch(() => undefined);
    }
    check();
    const timer = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  if (!account) {
    return (
      <div className={s.window}>
        {progress && <UpdateScreen version={version} progress={progress} />}
        <FloatingTitlebar />
        {account === null ? (
          <Login />
        ) : (
          <div className={s.splash}>
            <Blocks />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={s.window}>
      {progress && <UpdateScreen version={version} progress={progress} />}
      <Rail />
      <Titlebar />
      <main ref={main} className={s.main}>
        <div className={s.view} key={pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function UpdateScreen({ version, progress }: { version?: string; progress: UpdateProgress }) {
  return (
    <div className={s.update}>
      <FloatingTitlebar />
      <div className={s.card}>
        <h2>Обновление лаунчера до v{version}</h2>
        <UpdateProgressBar progress={progress} />
      </div>
    </div>
  );
}
