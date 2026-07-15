import {
  createClub,
  joinClubByCode,
  leaveClub,
  removeClubMember,
  rotateClubJoinCode,
  getMyClubs,
  getClubDetail,
  getClubByCode,
} from '../clubs';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('clubs writes (F040)', () => {
  it('createClub forwards the snake_case RPC params with null defaults', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });
    await createClub({ name: 'My Club' });
    expect(mockRpc).toHaveBeenCalledWith('create_club', {
      p_name: 'My Club',
      p_description: null,
      p_avatar_url: null,
      p_city_id: null,
      p_home_venue_id: null,
    });
  });

  it('createClub passes through description/avatar/city/venue', async () => {
    mockRpc.mockResolvedValue({ data: 9, error: null });
    await createClub({
      name: 'Smashers',
      description: 'Sunday club',
      avatarUrl: 'https://x/y.jpg',
      cityId: 3,
      homeVenueId: 12,
    });
    expect(mockRpc).toHaveBeenCalledWith('create_club', {
      p_name: 'Smashers',
      p_description: 'Sunday club',
      p_avatar_url: 'https://x/y.jpg',
      p_city_id: 3,
      p_home_venue_id: 12,
    });
  });

  it('joinClubByCode forwards the code', async () => {
    mockRpc.mockResolvedValue({ data: 4, error: null });
    await joinClubByCode('ABC123');
    expect(mockRpc).toHaveBeenCalledWith('join_club_by_code', { p_code: 'ABC123' });
  });

  it('leave / remove / rotate call their RPCs with the right args', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await leaveClub(5);
    expect(mockRpc).toHaveBeenCalledWith('leave_club', { p_club_id: 5 });

    await removeClubMember(5, 'user-1');
    expect(mockRpc).toHaveBeenCalledWith('remove_club_member', { p_club_id: 5, p_user_id: 'user-1' });

    mockRpc.mockResolvedValue({ data: 'NEW999', error: null });
    const res = await rotateClubJoinCode(5);
    expect(mockRpc).toHaveBeenCalledWith('rotate_club_join_code', { p_club_id: 5 });
    expect(res.data).toBe('NEW999');
  });
});

describe('clubs reads (F040)', () => {
  it('getMyClubs returns the rows (empty array on null data)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getMyClubs();
    expect(data).toEqual([]);
  });

  it('getMyClubs passes through rows', async () => {
    const rows = [{ id: 1, name: 'A', role: 'admin', member_count: 3 }];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const { data } = await getMyClubs();
    expect(data).toEqual(rows);
  });

  it('getClubDetail unwraps a single-row table result', async () => {
    const row = { id: 1, name: 'A', members: [], upcoming_events: [] };
    mockRpc.mockResolvedValue({ data: [row], error: null });
    const { data } = await getClubDetail(1);
    expect(mockRpc).toHaveBeenCalledWith('get_club_detail', { p_club_id: 1 });
    expect(data).toEqual(row);
  });

  it('getClubByCode unwraps and normalizes', async () => {
    const row = { id: 2, name: 'B', avatar_url: null, member_count: 1, already_member: false };
    mockRpc.mockResolvedValue({ data: [row], error: null });
    const { data } = await getClubByCode('XyZ123');
    expect(mockRpc).toHaveBeenCalledWith('get_club_by_code', { p_code: 'XyZ123' });
    expect(data).toEqual(row);
  });

  it('getClubByCode returns null when no club matches', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data } = await getClubByCode('NONE00');
    expect(data).toBeNull();
  });
});
