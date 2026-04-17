import {
  createRootRoute,
  createRoute,
  createRouter,
  defaultStringifySearch,
  Outlet,
} from '@tanstack/react-router';
import { DetailPage } from './pages/detail-page';
import { HomePage } from './pages/home-page';
import { cleanSearch, parseSearch } from './lib/search';

function RootLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search) => parseSearch(search as Record<string, unknown>),
  component: HomePage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/informe/$affidavitId',
  validateSearch: (search) => parseSearch(search as Record<string, unknown>),
  component: DetailPage,
});

const routeTree = rootRoute.addChildren([indexRoute, detailRoute]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  stringifySearch: (search) =>
    defaultStringifySearch(cleanSearch(parseSearch(search as Record<string, unknown>))),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
