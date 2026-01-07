import { createFileRoute, Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useAuth } from '@workos/authkit-tanstack-react-start/client';
import { getAuth, getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start';
import type { User } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const { user } = await getAuth();
    const signInUrl = await getSignInUrl();
    const signUpUrl = await getSignUpUrl();

    return { user, signInUrl, signUpUrl };
  },
});

function Home() {
  const { user, signInUrl, signUpUrl } = Route.useLoaderData();
  return <HomeContent user={user} signInUrl={signInUrl} signUpUrl={signUpUrl} />;
}

function HomeContent({ user, signInUrl, signUpUrl }: { user: User | null; signInUrl: string; signUpUrl: string }) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Monitoreo Panama
        {user && <UserMenu user={user} />}
      </header>
      <main className="p-8 flex flex-col gap-8">
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <SignInForm signInUrl={signInUrl} signUpUrl={signUpUrl} />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInForm({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <p>Please sign in to continue</p>
      <a href={signInUrl}>
        <button className="bg-foreground text-background px-4 py-2 rounded-md">Sign in</button>
      </a>
      <a href={signUpUrl}>
        <button className="bg-foreground text-background px-4 py-2 rounded-md">Sign up</button>
      </a>
    </div>
  );
}

function Content() {
  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>Welcome!</p>
      <Link
        to="/documents"
        className="bg-foreground text-background px-6 py-3 rounded-md text-center hover:opacity-90 transition-opacity"
      >
        Go to Documents
      </Link>
    </div>
  );
}

function UserMenu({ user }: { user: User }) {
  const { signOut } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{user.email}</span>
      <button onClick={() => signOut()} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">
        Sign out
      </button>
    </div>
  );
}
