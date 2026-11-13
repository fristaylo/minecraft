import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { currentAccount, errorText, listUsers, logout as apiLogout, type Me } from '@/api';
import { useToast } from './Toast';

type Session = {
  account: Me | null | undefined;
  setAccount: Dispatch<SetStateAction<Me | null | undefined>>;
  logout: () => Promise<void>;
  pending: number;
  refreshPending: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [account, setAccount] = useState<Me | null | undefined>(undefined);
  const [pending, setPending] = useState(0);
  const isAdmin = account?.role === 'admin';

  useEffect(() => {
    currentAccount()
      .then(setAccount)
      .catch((error: unknown) => {
        setAccount(null);
        toast('Нет связи с сервером', errorText(error), { kind: 'warn' });
      });
  }, [toast]);

  useEffect(() => {
    if (account?.role !== 'pending') return;
    const timer = setInterval(() => void currentAccount().then(setAccount, () => undefined), 30000);
    return () => clearInterval(timer);
  }, [account?.role]);

  const refreshPending = useCallback(async () => {
    if (!isAdmin) return setPending(0);
    const users = await listUsers().catch(() => []);
    setPending(users.filter((user) => user.role === 'pending').length);
  }, [isAdmin]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  const value = useMemo<Session>(
    () => ({
      account,
      setAccount,
      pending,
      refreshPending,
      async logout() {
        await apiLogout();
        setAccount(null);
      },
    }),
    [account, pending, refreshPending],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing');
  return value;
}

export function useAccount(): Me {
  const { account } = useSession();
  if (!account) throw new Error('Account is missing');
  return account;
}
