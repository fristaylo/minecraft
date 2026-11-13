import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from '@components/Shell/Shell';
import { Admin } from '@pages/Admin/Admin';
import { Home } from '@pages/Home/Home';
import { Mods } from '@pages/Mods/Mods';
import { Settings } from '@pages/Settings/Settings';
import { Skin } from '@pages/Skin/Skin';
import { GameProvider } from './context/Game';
import { SessionProvider, useSession } from './context/Session';
import { SettingsProvider } from './context/Settings';
import { ToastProvider } from './context/Toast';
import './main.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <ToastProvider>
        <SettingsProvider>
          <SessionProvider>
            <GameProvider>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Home />} />
                  <Route path="mods" element={<Mods />} />
                  <Route path="skin" element={<Skin />} />
                  <Route path="settings" element={<Settings />} />
                  <Route
                    path="admin"
                    element={
                      <AdminGuard>
                        <Admin />
                      </AdminGuard>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </GameProvider>
          </SessionProvider>
        </SettingsProvider>
      </ToastProvider>
    </MemoryRouter>
  </StrictMode>,
);

function AdminGuard({ children }: { children: ReactNode }) {
  const { account } = useSession();
  return account?.role === 'admin' ? children : <Navigate to="/" replace />;
}
