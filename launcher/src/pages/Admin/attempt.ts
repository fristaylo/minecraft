import { useCallback } from 'react';
import { errorText } from '@/api';
import { useToast } from '@/context/Toast';

export function useAttempt() {
  const toast = useToast();
  return useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        toast('Не удалось выполнить действие', errorText(error), { kind: 'warn' });
      }
    },
    [toast],
  );
}
