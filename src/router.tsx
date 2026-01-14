import { createRouter, useRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { useEffect } from 'react';
import { routeTree } from './routeTree.gen';

function DefaultErrorComponent({ error }: { error: Error }) {
  const router = useRouter();

  useEffect(() => {
    if (error.message.includes('Unauthorized')) {
      router.navigate({ to: '/' });
    }
  }, [error, router]);

  if (error.message.includes('Unauthorized')) {
    return <p>Redirecting to login...</p>;
  }

  return <p>{error.stack}</p>;
}

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    throw new Error('missing VITE_CONVEX_URL env var');
  }
  const convex = new ConvexReactClient(CONVEX_URL);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultPreloadStaleTime: 0, // Let React Query handle all caching
    defaultErrorComponent: ({ error }) => <DefaultErrorComponent error={error} />,
    defaultNotFoundComponent: () => <p>not found</p>,
    context: { queryClient, convexClient: convex },
    Wrap: ({ children }) => <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
