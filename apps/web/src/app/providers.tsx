'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { SocketProvider } from '@/lib/socket-context';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 10,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          {children}
          <Toaster />
          <ConfirmDialogHost />
        </SocketProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
