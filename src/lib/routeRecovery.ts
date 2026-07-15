export function recoverRouteFromUnmatchedPath(pathname?: string | null): string {
  return recoverSharedRoute(pathname) ?? '/(tabs)/';
}

/** Resolve a public/shared URL path without forcing unknown paths to tabs. */
export function recoverSharedRoute(pathname?: string | null): string | null {
  const rawPath = pathname?.split(/[?#]/)[0] ?? '';
  let path = rawPath;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }

  const venueMatch = path.match(/(?:^|\/)venue\/([^/]+)\/?$/);
  if (venueMatch?.[1]) {
    return `/venue/${encodeURIComponent(venueMatch[1])}`;
  }

  const eventMatch = path.match(/(?:^|\/)event\/([^/]+)\/?$/);
  if (eventMatch?.[1]) {
    return `/event/${encodeURIComponent(eventMatch[1])}`;
  }

  const playerMatch = path.match(/(?:^|\/)player\/([^/]+)\/?$/);
  if (playerMatch?.[1]) {
    return `/(protected)/player/${encodeURIComponent(playerMatch[1])}`;
  }

  const joinMatch = path.match(/(?:^|\/)join\/([^/]+)\/?$/);
  if (joinMatch?.[1]) {
    return `/join/${encodeURIComponent(joinMatch[1])}`;
  }

  return null;
}
