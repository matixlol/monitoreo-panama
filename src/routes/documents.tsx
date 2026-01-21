import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Authenticated } from 'convex/react';
import { UserMenu } from '../components/UserMenu';

export const Route = createFileRoute('/documents')({
  component: DocumentsLayout,
});

function DocumentsLayout() {
  const location = useLocation();
  const isDiscrepancias = location.pathname === '/documents/discrepancias';

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          Monitoreo Panama
        </Link>
        <Authenticated>
          <UserMenu />
        </Authenticated>
      </header>
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Documentos PDF</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Sube documentos PDF para extraer datos financieros
            </p>
          </div>

          <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
            <nav className="-mb-px flex gap-4">
              <Link
                to="/documents"
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  !isDiscrepancias
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Documentos
              </Link>
              <Link
                to="/documents/discrepancias"
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isDiscrepancias
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Discrepancias
              </Link>
            </nav>
          </div>

          <Outlet />
        </div>
      </div>
    </>
  );
}
