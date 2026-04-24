import { useLayoutEffect } from 'react';

const LOVABLE_OAUTH_ORIGIN = 'https://oauth.lovable.app';

/**
 * If the user somehow lands on `/<~oauth/...` on this origin (e.g. before broker URL
 * was configured, or a stale link), hand off to the Lovable OAuth host with the same path
 * and query so the flow can complete.
 */
export function LovableOauthRedirect() {
  useLayoutEffect(() => {
    const { pathname, search, hash } = window.location;
    if (!pathname.startsWith('/~oauth')) return;
    window.location.replace(`${LOVABLE_OAUTH_ORIGIN}${pathname}${search}${hash}`);
  }, []);
  return null;
}
