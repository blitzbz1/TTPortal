// Helpers that append Supabase Storage image-transform query params so we
// download a sized image instead of the full original. The original is
// already resized to ~1MP at upload time (uploadVenuePhoto), but the
// photo-strip and thumbnail surfaces typically only need 800px-wide JPEGs.

/** Returns true if `url` looks like a Supabase Storage public URL. */
function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/(object|render)\/public\//.test(url);
}

/**
 * Convert a Supabase Storage public URL into the rendering endpoint with
 * width/quality transforms. No-ops for non-Supabase URLs (e.g. local file://
 * URIs from `expo-image-picker`).
 */
export function venueImageUrl(
  url: string | null | undefined,
  opts: { width?: number; quality?: number } = {},
): string | null | undefined {
  if (!url) return url;
  if (!isSupabaseStorageUrl(url)) return url;

  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const params: string[] = [];
  if (opts.width) params.push(`width=${Math.round(opts.width)}`);
  if (opts.quality) params.push(`quality=${Math.round(opts.quality)}`);
  if (!params.length) return transformed;
  return `${transformed}${transformed.includes('?') ? '&' : '?'}${params.join('&')}`;
}
