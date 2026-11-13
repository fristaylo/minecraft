import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Blocks } from '@components/Loaders/Loaders';
import { Rail } from '@components/Rail/Rail';
import { FloatingTitlebar, Titlebar } from '@components/Titlebar/Titlebar';
import { UpdateInstall } from '@components/UpdateInstall/UpdateInstall';
import { Login } from '@pages/Login/Login';
import { checkUpdate } from '@/api';
import { useSession } from '@/context/Session';
import { useToast } from '@/context/Toast';
import s from './Shell.module.scss';

export function Shell() {
  const { account } = useSession();
  const toast = useToast();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    checkUpdate()
      .then((update) => {
        if (!update) return;
        toast(`Доступна версия ${update.version}`, update.notes ?? '', {
          kind: 'info',
          icon: 'download',
          sticky: true,
          body: (close) => <UpdateInstall onLater={close} />,
        });
      })
      .catch(() => undefined);
  }, [toast]);

  if (!account) {
    return (
      <div className={s.window}>
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
