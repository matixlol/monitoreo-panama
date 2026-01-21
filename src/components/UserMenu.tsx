import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';

export function UserMenu() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  if (!isAuthenticated) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void signOut()}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
