export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface BadgeChallenge {
  id: string;
  title: string;
  mode: 'self' | 'friend optional' | 'friend required' | 'proof';
  tier: BadgeTier;
}

export interface BadgeTrack {
  id: string;
  category: string;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  color: string;
  paleColor: string;
  challenges: Record<BadgeTier, BadgeChallenge[]>;
}

export const TIER_TARGETS: Record<BadgeTier, number> = {
  bronze: 5,
  silver: 10,
  gold: 15,
};

export const BADGE_TIERS: BadgeTier[] = ['bronze', 'silver', 'gold'];

export const BADGE_TRACKS: BadgeTrack[] = [
  {
    id: 'craft-player',
    category: 'craft_player',
    name: 'Craft Player',
    shortName: 'Craft',
    icon: 'brain',
    description: 'Control, focus, smart play.',
    color: '#2563eb',
    paleColor: '#dbeafe',
    challenges: {
      bronze: [
        { id: 'BRZ004', title: 'Play a session longer than two hours', mode: 'friend optional', tier: 'bronze' },
        { id: 'BRZ005', title: 'Be as fairplay as Timo Boll', mode: 'self', tier: 'bronze' },
        { id: 'BRZ011', title: 'Play 3 matches in one day', mode: 'friend optional', tier: 'bronze' },
        { id: 'BRZ013', title: 'Try a new rubber or paddle', mode: 'friend optional', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV003', title: 'Play a set with your non-dominant hand', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV019', title: 'Win 5 points in a row', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV033', title: 'Play a set without looking at the score', mode: 'self', tier: 'silver' },
        { id: 'SLV034', title: 'Play a match using only 50% power', mode: 'friend optional', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD001', title: 'Win 11-0', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD009', title: 'Win 3 matches in a row', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD010', title: 'Comeback from 0-2', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD015', title: 'Match without unforced errors', mode: 'self', tier: 'gold' },
      ],
    },
  },
  {
    id: 'spin-artist',
    category: 'spin_artist',
    name: 'Spin Artist',
    shortName: 'Spin',
    icon: 'refresh-cw',
    description: 'Spin mastery.',
    color: '#0891b2',
    paleColor: '#cffafe',
    challenges: {
      bronze: [
        { id: 'BRZ101', title: 'Maintain a backspin rally of 10 shots', mode: 'self', tier: 'bronze' },
        { id: 'BRZ102', title: 'Land 5 controlled topspins against a passive block', mode: 'self', tier: 'bronze' },
        { id: 'BRZ103', title: 'Successfully return 5 sidespin serves', mode: 'self', tier: 'bronze' },
        { id: 'BRZ136', title: 'Place 5 backspin balls to a chosen target zone', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV101', title: 'Place 8 backspin shots alternately short and long', mode: 'self', tier: 'silver' },
        { id: 'SLV102', title: 'Maintain a topspin rally of 15 shots', mode: 'self', tier: 'silver' },
        { id: 'SLV103', title: 'Return sidespin serves with controlled placement 5 times', mode: 'self', tier: 'silver' },
        { id: 'SLV145', title: 'Change spin type during a rally and stay in the point', mode: 'friend optional', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD101', title: 'Win a rally using at least 2 different spin types', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD102', title: 'Win 3 points using topspin attacks under pressure', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD133', title: 'Win a set by controlling the short game and opening first', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD142', title: 'Win a rally with a counterloop from both sides', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'first-attack',
    category: 'first_attack_burst',
    name: 'First Attack',
    shortName: 'Attack',
    icon: 'zap',
    description: 'Starting the attack.',
    color: '#dc2626',
    paleColor: '#fee2e2',
    challenges: {
      bronze: [
        { id: 'BRZ110', title: 'Win a point within first 3 shots', mode: 'friend optional', tier: 'bronze' },
        { id: 'BRZ111', title: 'Execute 3 successful third-ball attacks', mode: 'self', tier: 'bronze' },
        { id: 'BRZ134', title: 'Open the rally with topspin after 2 pushes', mode: 'self', tier: 'bronze' },
        { id: 'BRZ141', title: 'Start the attack after receiving a long serve', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV110', title: 'Win 3 points using serve + attack combination', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV111', title: 'Land 5 controlled opening loops', mode: 'self', tier: 'silver' },
        { id: 'SLV138', title: 'Execute 3 successful backhand openings against backspin', mode: 'self', tier: 'silver' },
        { id: 'SLV139', title: 'Serve short and win after a long return', mode: 'friend optional', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD110', title: 'Win 5 points directly from third-ball attack', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD111', title: 'Win a set using aggressive first attacks', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD132', title: 'Win 3 points using a serve + third-ball + fifth-ball pattern', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD140', title: 'Win 3 points by attacking after a short receive exchange', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'footwork-engine',
    category: 'footwork_engine',
    name: 'Footwork Engine',
    shortName: 'Footwork',
    icon: 'move',
    description: 'Movement and positioning.',
    color: '#16a34a',
    paleColor: '#dcfce7',
    challenges: {
      bronze: [
        { id: 'BRZ120', title: 'Complete 10 controlled side-to-side movements', mode: 'self', tier: 'bronze' },
        { id: 'BRZ121', title: 'Return to ready position after every shot for 1 rally', mode: 'self', tier: 'bronze' },
        { id: 'BRZ135', title: 'Serve and recover to ready position correctly 5 times', mode: 'self', tier: 'bronze' },
        { id: 'BRZ139', title: 'Alternate 8 placements from forehand to backhand', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV120', title: 'Execute 3 successful pivot attacks', mode: 'self', tier: 'silver' },
        { id: 'SLV121', title: 'Maintain movement during a 10-shot rally', mode: 'self', tier: 'silver' },
        { id: 'SLV135', title: 'Pivot to attack and recover back into the rally', mode: 'self', tier: 'silver' },
        { id: 'SLV148', title: 'Maintain a forehand-backhand transition rally of 12 shots', mode: 'self', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD120', title: 'Win 3 points using active footwork positioning', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD121', title: 'Recover position and win 3 extended rallies', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD006', title: 'Forehand all around table like Quadri Aruna', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD037', title: 'Step around and win with a forehand loop', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'table-guardian',
    category: 'table_guardian',
    name: 'Table Guardian',
    shortName: 'Guardian',
    icon: 'shield',
    description: 'Defense and consistency.',
    color: '#475569',
    paleColor: '#e2e8f0',
    challenges: {
      bronze: [
        { id: 'BRZ130', title: 'Successfully block 5 shots in a row', mode: 'self', tier: 'bronze' },
        { id: 'BRZ131', title: 'Return 5 balls using defensive chop', mode: 'self', tier: 'bronze' },
        { id: 'BRZ137', title: 'Block 5 attacking balls back to the middle', mode: 'self', tier: 'bronze' },
        { id: 'BRZ142', title: 'Block 5 balls in a row back to the middle', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV130', title: 'Block 10 shots in a rally', mode: 'self', tier: 'silver' },
        { id: 'SLV131', title: 'Return 3 attacks using defensive lobs', mode: 'self', tier: 'silver' },
        { id: 'SLV136', title: 'Block 6 balls deep while changing direction', mode: 'self', tier: 'silver' },
        { id: 'SLV143', title: 'Stay in the rally through 3 consecutive attacking balls', mode: 'self', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD130', title: 'Win 3 points by transitioning from defense to attack', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD131', title: 'Win a point after defending with 3+ lobs', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD137', title: 'Defend 3 attacks and win with a counterattack', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD143', title: 'Absorb short and deep pressure, then win the point', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'serve-lab',
    category: 'serve_lab',
    name: 'Serve Lab',
    shortName: 'Serve',
    icon: 'flask-conical',
    description: 'Serves and creativity.',
    color: '#9333ea',
    paleColor: '#f3e8ff',
    challenges: {
      bronze: [
        { id: 'BRZ023', title: 'Learn and try one new serve', mode: 'self', tier: 'bronze' },
        { id: 'BRZ039', title: 'Serve 5 legal serves in a row', mode: 'self', tier: 'bronze' },
        { id: 'BRZ132', title: 'Serve 3 short balls that bounce twice', mode: 'friend optional', tier: 'bronze' },
        { id: 'BRZ138', title: 'Land 5 short serves to the backhand half', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV001', title: 'Win a set serving only with the backhand', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV002', title: 'Two consecutive successful tomahawk serves', mode: 'self', tier: 'silver' },
        { id: 'SLV020', title: 'Successfully execute 3 different serves in one set', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV023', title: 'Play a full set without missing a serve', mode: 'friend optional', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD011', title: 'Perfect serve set with no lost serve points', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD012', title: 'Win using 3 serve types', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD136', title: 'Win 3 points using a surprise long serve setup', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD148', title: 'Win a set using a planned serve, receive, and first-attack pattern', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'competitor',
    category: 'competitor',
    name: 'Competitor',
    shortName: 'Compete',
    icon: 'trophy',
    description: 'Winning and match play.',
    color: '#ca8a04',
    paleColor: '#fef3c7',
    challenges: {
      bronze: [
        { id: 'BRZ015', title: 'Win a point with a simple push rally', mode: 'friend optional', tier: 'bronze' },
        { id: 'BRZ016', title: 'Successfully return 5 serves in a row', mode: 'self', tier: 'bronze' },
        { id: 'BRZ033', title: 'Forehand drive, 10 in a row', mode: 'self', tier: 'bronze' },
        { id: 'BRZ034', title: 'Backhand drive, 10 in a row', mode: 'self', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV004', title: 'Win against a chopper', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV021', title: 'Win a point with a third ball attack', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV022', title: 'Win a rally of 10+ shots', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV028', title: 'Perform 3 successful flicks', mode: 'self', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD013', title: 'Perfect third ball attacks', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD034', title: 'Win a point with a banana flick receive', mode: 'friend optional', tier: 'gold' },
        { id: 'GLD035', title: 'Counter-topspin, 3 balls in a row', mode: 'self', tier: 'gold' },
        { id: 'GLD147', title: 'Win a point with short game, opening attack, and counter phase', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
  {
    id: 'explorer',
    category: 'explorer',
    name: 'Explorer',
    shortName: 'Explore',
    icon: 'map-pin',
    description: 'Playing, social and activity.',
    color: '#0f766e',
    paleColor: '#ccfbf1',
    challenges: {
      bronze: [
        { id: 'BRZ001', title: 'Play at any indoor venue', mode: 'proof', tier: 'bronze' },
        { id: 'BRZ002', title: 'Play at any outdoor venue', mode: 'proof', tier: 'bronze' },
        { id: 'BRZ003', title: 'Check in at two locations in the same day', mode: 'proof', tier: 'bronze' },
        { id: 'BRZ012', title: 'Play with a new opponent', mode: 'friend required', tier: 'bronze' },
      ],
      silver: [
        { id: 'SLV146', title: 'Play a best-of-three match with a friend', mode: 'friend required', tier: 'silver' },
        { id: 'SLV147', title: 'Win 2 points in deuce situations during one match', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV022', title: 'Win a rally of 10+ shots', mode: 'friend optional', tier: 'silver' },
        { id: 'SLV031', title: "Play a mirror match by copying your opponent's style", mode: 'friend optional', tier: 'silver' },
      ],
      gold: [
        { id: 'GLD028', title: 'Let the crowd decide your tactics', mode: 'proof', tier: 'gold' },
        { id: 'GLD030', title: 'Play doubles with a stranger', mode: 'friend required', tier: 'gold' },
        { id: 'GLD144', title: 'Beat two different opponents in the same session', mode: 'friend required', tier: 'gold' },
        { id: 'GLD020', title: 'Win final deciding set', mode: 'friend optional', tier: 'gold' },
      ],
    },
  },
];

export function getTrackChallenges(track: BadgeTrack) {
  return BADGE_TIERS.flatMap((tier) => track.challenges[tier]);
}

export function getCompletedCount(completed: Set<string>, badgeId: string) {
  return [...completed].filter((key) => key.startsWith(`${badgeId}:`)).length;
}

export function getBadgeLevel(completedCount: number) {
  if (completedCount >= TIER_TARGETS.gold) return 'Gold';
  if (completedCount >= TIER_TARGETS.silver) return 'Silver';
  if (completedCount >= TIER_TARGETS.bronze) return 'Bronze';
  return 'Locked';
}

export function getCurrentAwardTier(completedCount: number): BadgeTier {
  if (completedCount >= TIER_TARGETS.silver) return 'gold';
  if (completedCount >= TIER_TARGETS.bronze) return 'silver';
  return 'bronze';
}
