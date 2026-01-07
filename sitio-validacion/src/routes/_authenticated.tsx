import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    // We'll check authentication client-side via the Authenticated/Unauthenticated components
    // For server-side protection in the future, you could use the convex auth helpers
  },
  component: () => <Outlet />,
});
