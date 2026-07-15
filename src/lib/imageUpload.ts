// Shared image-prep pipeline for any feature that uploads photos to
// Supabase Storage (venue gallery, future avatar / event banner / etc).
//
// Why a helper
// ============
// Every upload site needs the same treatment: resize to a sensible max
// dimension, re-encode as JPEG with a fixed quality, refuse to ship the
// original if the native ImageManipulator module is unavailable. Without
// a helper, each new screen copies the logic — and any one of those
// copies forgetting the size cap silently inflates storage egress for
// everyone, with no signal at runtime that anything is wrong.

// Lazy-load the native module once at module init. expo-image-manipulator
// requires native code, so a misconfigured build (test environment, Expo
// Go without the right plugin, etc.) won't have it. We fail loud rather
// than ship originals.
type ManipulatorModule = typeof import('expo-image-manipulator');
let ImageManipulator: ManipulatorModule | null = null;
try {
  // require() (rather than `import`) so the failure path is recoverable —
  // a missing native module would throw at module-load time with `import`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImageManipulator = require('expo-image-manipulator');
} catch {}

export interface PrepareImageInput {
  uri: string;
  width?: number | null;
  height?: number | null;
}

export interface PrepareImageOptions {
  // Cap for the longest side, in pixels. Anything larger is resized
  // proportionally; smaller images are passed through (still re-encoded).
  maxDimension?: number;
  // JPEG quality, 0..1.
  quality?: number;
}

export class ImageProcessingUnavailableError extends Error {
  constructor() {
    super('Image processing is unavailable on this device.');
    this.name = 'ImageProcessingUnavailableError';
  }
}

/**
 * Resize + re-encode an image asset for upload. Returns the local URI of
 * the prepared file. Throws ImageProcessingUnavailableError when the
 * native ImageManipulator module is missing (caller should surface a
 * user-facing error and refuse the upload).
 */
export async function prepareImageForUpload(
  asset: PrepareImageInput,
  options: PrepareImageOptions = {},
): Promise<string> {
  if (!ImageManipulator) throw new ImageProcessingUnavailableError();
  const { maxDimension = 1024, quality = 0.8 } = options;
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const isLandscape = w >= h;
  const needsResize = w > maxDimension || h > maxDimension;
  const actions = needsResize
    ? [{ resize: isLandscape ? { width: maxDimension } : { height: maxDimension } }]
    : [];
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    actions,
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  return manipulated.uri;
}

// Test seam: lets the test suite simulate a missing-module environment
// without having to mess with the require cache. Production code does
// not import these.
export function __setImageManipulatorForTests(mod: ManipulatorModule | null): void {
  ImageManipulator = mod;
}
