import { createFileRoute, Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated, useConvexAuth } from 'convex/react';
import { useAction, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/admin')({
  component: AdminPage,
});

function AdminPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link to="/" className="hover:opacity-70">
          ← Back
        </Link>
        <span className="font-semibold">Admin Panel</span>
        <Authenticated>
          <UserMenu />
        </Authenticated>
      </header>
      <main className="p-8 flex flex-col gap-8">
        <Authenticated>
          <ReprocessStuckDocuments />
          <CreateUserForm />
        </Authenticated>
        <Unauthenticated>
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You must be logged in to access the admin panel.
            </p>
            <Link to="/" className="text-blue-500 hover:underline">
              Go to login
            </Link>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function ReprocessStuckDocuments() {
  const reprocess = useMutation(api.documents.reprocessStuckDocuments);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ reprocessed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await reprocess();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">Reprocess Stuck Documents</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Reset documents stuck in "processing" state and retry extraction
        </p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-md">{error}</div>
      )}

      {result && (
        <div className="text-emerald-700 dark:text-emerald-300 text-sm bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md">
          {result.reprocessed === 0
            ? 'No documents were stuck in processing'
            : `Reprocessed ${result.reprocessed} document(s)`}
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={isLoading}
        className="bg-amber-600 text-white px-4 py-2 rounded-md font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Reprocessing...' : 'Reprocess Stuck Documents'}
      </button>
    </div>
  );
}

function CreateUserForm() {
  const createUser = useAction(api.admin.createUser);
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const newUser = await createUser({ email });
      setResult(newUser);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Create New User</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Enter an email address to create a new user with a generated password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newuser@example.com"
            required
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-md">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="bg-foreground text-background px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create User'}
        </button>
      </form>

      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-4 rounded-md">
          <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
            User Created Successfully!
          </h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium">Email:</span>{' '}
              <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded">{result.email}</code>
            </p>
            <p>
              <span className="font-medium">Password:</span>{' '}
              <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded font-mono">
                {result.password}
              </code>
            </p>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">
            Make sure to save this password - it cannot be retrieved later!
          </p>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  if (!isAuthenticated) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void signOut()}
        className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
      >
        Sign out
      </button>
    </div>
  );
}

