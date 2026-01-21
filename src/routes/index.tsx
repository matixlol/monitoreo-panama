import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: '/documents', replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Monitoreo Panama
      </header>
      <main className="p-8 flex flex-col gap-8">
        <SignInForm />
      </main>
    </>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set('flow', 'signIn');

    try {
      await signIn('password', formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Sign In</h1>
        <p className="text-slate-600 dark:text-slate-400">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-md">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className="bg-foreground text-background px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}


