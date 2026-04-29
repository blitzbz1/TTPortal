// Next.js's basePath is not applied to <Image src="..."> when images.unoptimized is true,
// so we prefix asset URLs manually. The NEXT_PUBLIC_BASE_PATH var is inlined at build time.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE}${path}`;
}
