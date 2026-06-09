import { submitVenueChangeRequest, uploadChangeRequestImage } from '../venueChangeRequests';
import { ImageProcessingUnavailableError } from '../../lib/imageUpload';

const mockRpc = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
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
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } });
});

describe('submitVenueChangeRequest', () => {
  it('maps the full input to the submit RPC params', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });

    const { data, error } = await submitVenueChangeRequest(42, {
      nets: true,
      nightLighting: false,
      tablesCount: 3,
      markUnavailable: true,
      note: '  gone  ',
      photoUrl: 'https://cdn/p.jpg',
    });

    expect(mockRpc).toHaveBeenCalledWith('submit_venue_change_request', {
      p_venue_id: 42,
      p_nets: true,
      p_night_lighting: false,
      p_tables_count: 3,
      p_mark_unavailable: true,
      p_note: '  gone  ',
      p_photo_url: 'https://cdn/p.jpg',
    });
    expect(data).toBe(7);
    expect(error).toBeNull();
  });

  it('defaults missing fields to null / false', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });

    await submitVenueChangeRequest(9, {});

    expect(mockRpc).toHaveBeenCalledWith('submit_venue_change_request', {
      p_venue_id: 9,
      p_nets: null,
      p_night_lighting: null,
      p_tables_count: null,
      p_mark_unavailable: false,
      p_note: null,
      p_photo_url: null,
    });
  });

  it('forwards RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } });

    const { data, error } = await submitVenueChangeRequest(1, { markUnavailable: true });

    expect(error).toEqual({ message: 'nope' });
    expect(data).toBeNull();
  });
});

describe('uploadChangeRequestImage', () => {
  const asset = { uri: 'file:///orig.jpg', width: 4000, height: 3000 };

  it('resizes, passes the daily-cap check, uploads, and returns the public URL', async () => {
    mockRpc.mockResolvedValue({ error: null }); // record_image_upload OK

    const res = await uploadChangeRequestImage(10, asset);

    expect(mockPrepare).toHaveBeenCalledWith({ uri: 'file:///orig.jpg', width: 4000, height: 3000 });
    expect(mockRpc).toHaveBeenCalledWith('record_image_upload');
    expect(mockUpload).toHaveBeenCalled();
    expect(mockUpload.mock.calls[0][0]).toMatch(/^change-requests\/10\/\d+\.jpg$/);
    expect(res).toEqual({ ok: true, url: 'https://cdn/x.jpg' });
  });

  it('stops at the daily cap and never uploads', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rate_limit_exceeded:user:upload_image:86400:10' } });

    const res = await uploadChangeRequestImage(10, asset);

    expect(mockUpload).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: false, reason: 'rate_limited' });
  });

  it('returns processing_unavailable without consuming quota when resize fails', async () => {
    mockPrepare.mockRejectedValue(new ImageProcessingUnavailableError());

    const res = await uploadChangeRequestImage(10, asset);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, reason: 'processing_unavailable' });
  });

  it('returns upload_failed when storage upload errors', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockUpload.mockResolvedValue({ error: { message: 'storage boom' } });

    const res = await uploadChangeRequestImage(10, asset);

    expect(res).toMatchObject({ ok: false, reason: 'upload_failed' });
  });
});
