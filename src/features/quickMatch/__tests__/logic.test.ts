import {
  createMatch,
  scorePoint,
  undoPoint,
  serverFor,
  gamesToWin,
  type MatchConfig,
  type MatchState,
  type PlayerIndex,
} from '../logic';

const cfg = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  points: 11,
  bestOf: 5,
  names: ['A', 'B'],
  firstServer: 0,
  ...over,
});

/** Apply a sequence of scoring players. */
const play = (state: MatchState, seq: PlayerIndex[]): MatchState =>
  seq.reduce((s, p) => scorePoint(s, p), state);

/** Win a game for `player` 11-0 (or points-0). */
const winGame = (state: MatchState, player: PlayerIndex, points = 11): MatchState =>
  play(state, Array.from({ length: points }, () => player));

describe('gamesToWin', () => {
  it('is ceil(bestOf/2)', () => {
    expect(gamesToWin(3)).toBe(2);
    expect(gamesToWin(5)).toBe(3);
    expect(gamesToWin(7)).toBe(4);
  });
});

describe('serverFor', () => {
  it('alternates every 2 points before deuce', () => {
    // firstServer 0: points 0,1 -> 0 ; 2,3 -> 1 ; 4,5 -> 0 ...
    expect(serverFor(0, 0, 11, 0)).toBe(0);
    expect(serverFor(1, 0, 11, 0)).toBe(0);
    expect(serverFor(1, 1, 11, 0)).toBe(1);
    expect(serverFor(2, 1, 11, 0)).toBe(1);
    expect(serverFor(2, 2, 11, 0)).toBe(0);
  });
  it('alternates every point at deuce (10-10)', () => {
    expect(serverFor(10, 10, 11, 0)).toBe(0);
    expect(serverFor(11, 10, 11, 0)).toBe(1);
    expect(serverFor(11, 11, 11, 0)).toBe(0);
  });
  it('honours the game first server', () => {
    expect(serverFor(0, 0, 11, 1)).toBe(1);
    expect(serverFor(1, 1, 11, 1)).toBe(0);
  });
});

describe('scorePoint — games', () => {
  it('needs a 2-point lead (deuce)', () => {
    let s = createMatch(cfg());
    s = play(s, Array.from({ length: 10 }, () => 0 as PlayerIndex)); // 10-0
    s = play(s, Array.from({ length: 10 }, () => 1 as PlayerIndex)); // 10-10
    expect(s.games).toEqual([0, 0]);
    s = scorePoint(s, 0); // 11-10, not won
    expect(s.games).toEqual([0, 0]);
    s = scorePoint(s, 0); // 12-10, won
    expect(s.games).toEqual([1, 0]);
    expect(s.completed).toEqual([[12, 10]]);
    expect(s.game).toEqual([0, 0]); // reset for next game
  });

  it('alternates the first server between games', () => {
    let s = createMatch(cfg({ firstServer: 0 }));
    expect(s.gameFirstServer).toBe(0);
    s = winGame(s, 0); // game 1 to A
    expect(s.gameFirstServer).toBe(1); // flipped for game 2
  });
});

describe('scorePoint — match', () => {
  it('best of 5 ends at 3 games and freezes the board', () => {
    let s = createMatch(cfg({ bestOf: 5 }));
    s = winGame(s, 0); // 1-0
    s = winGame(s, 0); // 2-0
    expect(s.winner).toBeNull();
    s = winGame(s, 0); // 3-0 -> match
    expect(s.winner).toBe(0);
    expect(s.games).toEqual([3, 0]);
    expect(s.game).toEqual([11, 0]); // final game kept on board
    // further points are ignored
    const after = scorePoint(s, 1);
    expect(after).toEqual(s);
  });

  it('supports best of 3 and best of 7', () => {
    let s3 = createMatch(cfg({ bestOf: 3 }));
    s3 = winGame(winGame(s3, 1), 1);
    expect(s3.winner).toBe(1);
    let s7 = createMatch(cfg({ bestOf: 7, points: 21 }));
    for (let i = 0; i < 4; i++) s7 = winGame(s7, 0, 21);
    expect(s7.winner).toBe(0);
    expect(s7.games).toEqual([4, 0]);
  });
});

describe('undoPoint', () => {
  it('decrements within the current game and floors at 0', () => {
    let s = createMatch(cfg());
    s = play(s, [0, 0, 1]); // 2-1
    s = undoPoint(s, 0); // 1-1
    expect(s.game).toEqual([1, 1]);
    s = undoPoint(s, 1); // 1-0
    s = undoPoint(s, 1); // 1-0 (floor)
    expect(s.game).toEqual([1, 0]);
  });

  it('re-opens a game finished by a mistap (auto-advance)', () => {
    let s = createMatch(cfg());
    s = play(s, Array.from({ length: 10 }, () => 0 as PlayerIndex)); // 10-0
    s = scorePoint(s, 0); // 11-0 -> game A, advanced to next game 0-0
    expect(s.games).toEqual([1, 0]);
    expect(s.game).toEqual([0, 0]);
    s = undoPoint(s, 0); // oops, undo the winning point
    expect(s.games).toEqual([0, 0]);
    expect(s.game).toEqual([10, 0]); // back to 10-0, game live
    expect(s.gameFirstServer).toBe(0); // restored
  });

  it('re-opens the match if the final point was a mistap', () => {
    let s = createMatch(cfg({ bestOf: 3 }));
    s = winGame(s, 0); // 1-0
    s = play(s, Array.from({ length: 10 }, () => 0 as PlayerIndex)); // game 2: 10-0
    s = scorePoint(s, 0); // 11-0 -> match (2-0)
    expect(s.winner).toBe(0);
    s = undoPoint(s, 0);
    expect(s.winner).toBeNull();
    expect(s.games).toEqual([1, 0]);
    expect(s.game).toEqual([10, 0]);
  });
});
