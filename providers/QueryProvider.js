'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export default function QueryProvider({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            // On returning after a long idle period, revalidate protected
            // dashboard/admin data. Axios renews the access token first when
            // necessary, so a still-valid session always regains its data.
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  // Never let a later login momentarily inherit protected cached data from a
  // previous account after a logout or an expired refresh session.
  useEffect(() => {
    const clearProtectedCache = () => queryClient.clear();
    window.addEventListener('dmdevelon:session-cleared', clearProtectedCache);
    return () =>
      window.removeEventListener(
        'dmdevelon:session-cleared',
        clearProtectedCache,
      );
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
