import {
  postCheckinMoment,
  deleteCheckinMoment,
  getVenueMoments,
  uploadMomentImage,
} from '../checkinMoments';

const mockRpc = jest.fn();
const mockGetUser = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    auth: { getUser: (...args: any[]) => mockGetUser(...args) },
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

const mockPrepare = jest.fn();
jest.mock('../../lib/imageUpload', () => ({
  prepareImageForUpload: (...args: any[]) => mockPrepare(...args),
  ImageProcessingUnavailableError: class ImageProcessingUnavailableError extends Error {},
}));

// The native upload branch builds a FormData; ensure it exists in the test env.
(global as any).FormData = class { append() {} } as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockResolvedValue('file:///resized.jpg');
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/moments/u-1/1.jpg' } });
});

describe('postCheckinMoment (F042)', () => {
  it('forwards check-in id, venue, photo and caption to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: 99, error: null });
    const res = await postCheckinMoment(7, 42, 'https://cdn/x.jpg', 'nice shot');
    expect(mockRpc).toHaveBeenCalledWith('post_checkin_moment', {
      p_checkin_id: 7,
      p_venue_id: 42,
      p_photo_url: 'https://cdn/x.jpg',
      p_caption: 'nice shot',
    });
    expect(res).toEqual({ data: 99, error: null });
  });

  it('passes a null caption through as undefined', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await postCheckinMoment(7, 42, 'https://cdn/x.jpg', null);
    expect(mockRpc).toHaveBeenCalledWith('post_checkin_moment', expect.objectContaining({ p_caption: undefined }));
  });

  it('surfaces an RPC error (e.g. checkin not yours)', async () => {
    const error = { message: 'checkin not found or not yours', code: 'P0001' };
    mockRpc.mockResolvedValue({ data: null, error });
    const res = await postCheckinMoment(7, 42, 'https://cdn/x.jpg');
    expect(res.error).toBe(error);
  });
});

describe('deleteCheckinMoment (F042)', () => {
  it('calls the soft-delete RPC with the moment id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await deleteCheckinMoment(55);
    expect(mockRpc).toHaveBeenCalledWith('delete_checkin_moment', { p_id: 55 });
  });
});

describe('getVenueMoments (F042)', () => {
  it('calls get_venue_moments and returns the rows', async () => {
    const rows = [{ id: 1, photo_url: 'https://cdn/a.jpg', caption: 'hi' }];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const res = await getVenueMoments(42, 8);
    expect(mockRpc).toHaveBeenCalledWith('get_venue_moments', { p_venue_id: 42, p_limit: 8 });
    expect(res.data).toEqual(rows);
  });

  it('returns an empty array when the RPC returns null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const res = await getVenueMoments(42);
    expect(res.data).toEqual([]);
  });
});

describe('uploadMomentImage (F042)', () => {
  it('resizes, records the daily cap, uploads to the moments bucket, returns the public URL', async () => {
    mockRpc.mockResolvedValue({ error: null }); // record_image_upload
    const res = await uploadMomentImage({ uri: 'file:///in.jpg', width: 2000, height: 1500 });
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('record_image_upload');
    // Path must be moments/<userId>/<ts>.jpg (prefix + depth required by RLS).
    expect(mockUpload).toHaveBeenCalled();
    expect(mockUpload.mock.calls[0][0]).toMatch(/^moments\/u-1\/\d+\.jpg$/);
    expect(res).toEqual({ ok: true, url: 'https://cdn/moments/u-1/1.jpg' });
  });

  it('returns processing_unavailable when the manipulator is missing', async () => {
    const { ImageProcessingUnavailableError } = jest.requireMock('../../lib/imageUpload');
    mockPrepare.mockRejectedValue(new ImageProcessingUnavailableError());
    const res = await uploadMomentImage({ uri: 'file:///in.jpg' });
    expect(res).toEqual({ ok: false, reason: 'processing_unavailable' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('returns rate_limited when the daily-cap RPC errors (before any upload)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rate_limit_exceeded' } });
    const res = await uploadMomentImage({ uri: 'file:///in.jpg' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('rate_limited');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('fails when there is no authenticated user (cannot build the path)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await uploadMomentImage({ uri: 'file:///in.jpg' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('upload_failed');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
