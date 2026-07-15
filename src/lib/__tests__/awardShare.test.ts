import type { RefObject } from 'react';
import { Platform } from 'react-native';
import type { View } from 'react-native';
import { shareAward } from '../awardShare';
import { shareCardImage } from '../shareImage';

jest.mock('../shareImage', () => ({ shareCardImage: jest.fn() }));

const mockedShareCardImage = shareCardImage as jest.MockedFunction<typeof shareCardImage>;
const cardRef = { current: {} } as unknown as RefObject<View | null>;
const base = {
  cardRef,
  message: 'Award unlocked',
  title: 'Award',
  url: 'https://example.com/award',
};

describe('shareAward', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.clearAllMocks();
  });

  it('uses the durable link share path on web', async () => {
    Platform.OS = 'web';
    const share = jest.fn().mockResolvedValue({ action: 'sheet' });

    await shareAward({ ...base, share });

    expect(mockedShareCardImage).not.toHaveBeenCalled();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Award unlocked',
      title: 'Award',
      url: 'https://example.com/award',
    }));
  });

  it('prefers the rendered award image on native', async () => {
    Platform.OS = 'android';
    mockedShareCardImage.mockResolvedValue(true);
    const share = jest.fn();

    await shareAward({ ...base, share });

    expect(mockedShareCardImage).toHaveBeenCalledWith(cardRef, 'Award unlocked');
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back to the durable link when native image capture fails', async () => {
    Platform.OS = 'android';
    mockedShareCardImage.mockResolvedValue(false);
    const share = jest.fn().mockResolvedValue({ action: 'sharedAction' });

    await shareAward({ ...base, share });

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('https://example.com/award'),
      title: 'Award',
    }));
  });
});
