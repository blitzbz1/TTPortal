import {
  prepareImageForUpload,
  ImageProcessingUnavailableError,
  __setImageManipulatorForTests,
} from '../imageUpload';

type ManipulatorMock = {
  manipulateAsync: jest.Mock;
  SaveFormat: { JPEG: 'jpeg' };
};

function makeManipulator(): ManipulatorMock {
  return {
    manipulateAsync: jest.fn(async (uri: string) => ({ uri: uri + '#prepared' })),
    SaveFormat: { JPEG: 'jpeg' },
  };
}

describe('prepareImageForUpload', () => {
  let mod: ManipulatorMock;

  beforeEach(() => {
    mod = makeManipulator();
    __setImageManipulatorForTests(mod as any);
  });

  afterAll(() => {
    __setImageManipulatorForTests(null);
  });

  it('throws ImageProcessingUnavailableError when the native module is missing', async () => {
    __setImageManipulatorForTests(null);
    await expect(
      prepareImageForUpload({ uri: 'file:///x.jpg', width: 100, height: 100 }),
    ).rejects.toBeInstanceOf(ImageProcessingUnavailableError);
  });

  it('returns the manipulated uri for an already-small image (no resize action)', async () => {
    const out = await prepareImageForUpload({ uri: 'file:///small.jpg', width: 800, height: 600 });
    expect(out).toBe('file:///small.jpg#prepared');
    // No resize action when both dims are <= maxDimension.
    expect(mod.manipulateAsync).toHaveBeenCalledWith(
      'file:///small.jpg',
      [],
      { compress: 0.8, format: 'jpeg' },
    );
  });

  it('resizes by width when the image is landscape and oversized', async () => {
    await prepareImageForUpload({ uri: 'file:///big.jpg', width: 4000, height: 3000 });
    expect(mod.manipulateAsync).toHaveBeenCalledWith(
      'file:///big.jpg',
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: 'jpeg' },
    );
  });

  it('resizes by height when the image is portrait and oversized', async () => {
    await prepareImageForUpload({ uri: 'file:///portrait.jpg', width: 3000, height: 4000 });
    expect(mod.manipulateAsync).toHaveBeenCalledWith(
      'file:///portrait.jpg',
      [{ resize: { height: 1024 } }],
      { compress: 0.8, format: 'jpeg' },
    );
  });

  it('honors a custom maxDimension and quality', async () => {
    await prepareImageForUpload(
      { uri: 'file:///avatar.jpg', width: 2000, height: 2000 },
      { maxDimension: 512, quality: 0.6 },
    );
    expect(mod.manipulateAsync).toHaveBeenCalledWith(
      'file:///avatar.jpg',
      [{ resize: { width: 512 } }],
      { compress: 0.6, format: 'jpeg' },
    );
  });

  it('treats missing dimensions as zero (no resize)', async () => {
    await prepareImageForUpload({ uri: 'file:///unknown.jpg' });
    expect(mod.manipulateAsync).toHaveBeenCalledWith(
      'file:///unknown.jpg',
      [],
      expect.any(Object),
    );
  });
});
