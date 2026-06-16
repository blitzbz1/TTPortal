import {
  findPlayers,
  sendMatchInvite,
  acceptMatchInvite,
  declineMatchInvite,
  getPartnerPreferences,
  setPartnerPreferences,
  setDiscoverable,
} from '../findPlayers';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('findPlayers (F021)', () => {
  it('forwards filters as snake_case params (null when omitted)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await findPlayers({ skill: 'club' });
    expect(mockRpc).toHaveBeenCalledWith('find_players', {
      p_city: null, p_skill: 'club', p_style: null,
    });
  });

  it('maps rows to the FindPlayer shape', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        user_id: 'u', full_name: 'Bob', avatar_url: null, city: 'Cluj', username: 'bob',
        skill_level: 'club', play_goals: ['doubles'], grip: 'penhold', playing_style: 'attacker',
        dominant_hand: 'left', played_this_week: true, availability: ['evenings'], pref_note: 'gg',
      }],
      error: null,
    });
    const { data } = await findPlayers();
    expect(data[0]).toEqual({
      userId: 'u', fullName: 'Bob', avatarUrl: null, city: 'Cluj', username: 'bob',
      skillLevel: 'club', playGoals: ['doubles'], grip: 'penhold', playingStyle: 'attacker',
      dominantHand: 'left', playedThisWeek: true, availability: ['evenings'], prefNote: 'gg',
    });
  });
});

describe('match invites (F021)', () => {
  it('send/accept/decline call their RPCs', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await sendMatchInvite('u2', 5, 'gg');
    expect(mockRpc).toHaveBeenCalledWith('send_match_invite', { p_invitee_id: 'u2', p_venue_id: 5, p_note: 'gg' });
    await acceptMatchInvite(9);
    expect(mockRpc).toHaveBeenCalledWith('accept_match_invite', { p_invite_id: 9 });
    await declineMatchInvite(9);
    expect(mockRpc).toHaveBeenCalledWith('decline_match_invite', { p_invite_id: 9 });
  });

  it('sendMatchInvite defaults venue/note to null', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await sendMatchInvite('u2');
    expect(mockRpc).toHaveBeenCalledWith('send_match_invite', { p_invitee_id: 'u2', p_venue_id: null, p_note: null });
  });
});

describe('partner preferences (F021)', () => {
  it('getPartnerPreferences maps the row + null when absent', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect((await getPartnerPreferences()).data).toBeNull();

    mockRpc.mockResolvedValue({
      data: [{ sought_styles: ['lefty'], availability: ['weekends'], note: 'n', discoverable: true }],
      error: null,
    });
    expect((await getPartnerPreferences()).data).toEqual({
      soughtStyles: ['lefty'], availability: ['weekends'], note: 'n', discoverable: true,
    });
  });

  it('setPartnerPreferences + setDiscoverable forward params', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await setPartnerPreferences({ availability: ['mornings'] });
    expect(mockRpc).toHaveBeenCalledWith('set_partner_preferences', {
      p_sought_styles: [], p_availability: ['mornings'], p_note: null,
    });
    await setDiscoverable(true);
    expect(mockRpc).toHaveBeenCalledWith('set_discoverable', { p_value: true });
  });
});
