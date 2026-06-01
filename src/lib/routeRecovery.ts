export function recoverRouteFromUnmatchedPath(pathname?: string | null): string {
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
    return `/(protected)/event/${encodeURIComponent(eventMatch[1])}`;
  }

  return '/(tabs)/';
}
