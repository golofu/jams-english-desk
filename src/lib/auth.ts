// Who is signed in (cookie session issued by the Worker after Google login).
export type Me = {
  id: string;
  email: string;
  name: string;
  picture: string;
  /** A Gemini key is on file (their own, or the app's for sponsored accounts). */
  hasKey: boolean;
  sponsored: boolean;
};

/** null = not signed in; throws when the server can't be reached. */
export async function fetchMe(): Promise<Me | null> {
  const r = await fetch('/api/me', { cache: 'no-store' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(`me ${r.status}`);
  return (await r.json()) as Me;
}

export const LOGIN_URL = '/auth/google/start';

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/** Google blocks OAuth inside LINE's in-app browser: the page must reopen in Chrome/Safari. */
export const inLineBrowser = () => / Line\//i.test(navigator.userAgent);
export const openOutsideLine = () => {
  const u = new URL(location.href);
  u.searchParams.set('openExternalBrowser', '1');
  location.href = u.toString();
};
