// Quick Match — pure scoring logic for a live table-tennis scoreboard.
// A match is "best of N" games; each game is first to `points` with a 2-point
// lead (deuce). Serve alternates every 2 points until both reach points-1, then
// every point. Pure + deterministic so it's fully unit-testable.

export type Points = 11 | 21;
export type BestOf = 3 | 5 | 7;
export type PlayerIndex = 0 | 1;

export interface MatchConfig {
  points: Points;
  bestOf: BestOf;
  names: [string, string];
  /** Who serves first in game 1. */
  firstServer: PlayerIndex;
}

export interface MatchState {
  config: MatchConfig;
  /** Points in the current (in-progress) game. */
  game: [number, number];
  /** Games won so far. */
  games: [number, number];
  /** Final scores of completed games, in order. */
  completed: [number, number][];
  /** Who served first in the current game. */
  gameFirstServer: PlayerIndex;
  /** Set once a player reaches the games needed to win the match. */
  winner: PlayerIndex | null;
}

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

/** Games a player must win to take the match (best of 3→2, 5→3, 7→4). */
export const gamesToWin = (bestOf: BestOf): number => Math.ceil(bestOf / 2);

export function createMatch(config: MatchConfig): MatchState {
  return {
    config,
    game: [0, 0],
    games: [0, 0],
    completed: [],
    gameFirstServer: config.firstServer,
    winner: null,
  };
}

/** Who serves the NEXT point, given the current game score. */
export function serverFor(
  a: number,
  b: number,
  points: Points,
  gameFirstServer: PlayerIndex,
): PlayerIndex {
  const total = a + b;
  const deuce = a >= points - 1 && b >= points - 1;
  // Before deuce: 2 serves per player (one "block" = 2 points). At deuce: 1 each.
  const blocks = deuce ? total : Math.floor(total / 2);
  return ((gameFirstServer + blocks) % 2) as PlayerIndex;
}

/** The player who has just won the current game, or null if it's still live. */
export function gameWinner(a: number, b: number, points: Points): PlayerIndex | null {
  if (a >= points && a - b >= 2) return 0;
  if (b >= points && b - a >= 2) return 1;
  return null;
}

/** Award a point to `player`. Auto-completes games and the match. */
export function scorePoint(state: MatchState, player: PlayerIndex): MatchState {
  if (state.winner !== null) return state;

  const game: [number, number] = [state.game[0], state.game[1]];
  game[player] += 1;

  const gw = gameWinner(game[0], game[1], state.config.points);
  if (gw === null) {
    return { ...state, game };
  }

  // Game won → tally it.
  const games: [number, number] = [state.games[0], state.games[1]];
  games[gw] += 1;
  const completed: [number, number][] = [...state.completed, game];

  if (games[gw] >= gamesToWin(state.config.bestOf)) {
    // Match won — keep the final game score on the board.
    return { ...state, game, games, completed, winner: gw };
  }

  // Next game: reset score, alternate who serves first.
  return {
    ...state,
    game: [0, 0],
    games,
    completed,
    gameFirstServer: other(state.gameFirstServer),
    winner: null,
  };
}

/**
 * Decrease `player`'s score by one — for mistaps. Reverts within the current
 * game; if the player's last point just finished a game (or the match), that
 * game is re-opened so the correction is never trapped behind an auto-advance.
 */
export function undoPoint(state: MatchState, player: PlayerIndex): MatchState {
  // In-progress game: plain decrement.
  if (state.winner === null && state.game[player] > 0) {
    const game: [number, number] = [state.game[0], state.game[1]];
    game[player] -= 1;
    return { ...state, game };
  }

  // Otherwise: revert the most recent completed game IF this player won it.
  const idx = state.completed.length - 1;
  if (idx < 0) return state;
  const last = state.completed[idx];
  const lastWinner: PlayerIndex = last[0] > last[1] ? 0 : 1;
  if (lastWinner !== player) return state;

  const completed = state.completed.slice(0, idx);
  const games: [number, number] = [state.games[0], state.games[1]];
  games[player] -= 1;
  const game: [number, number] = [last[0], last[1]];
  game[player] -= 1; // drop below the winning score → game live again
  // A non-final game win advanced gameFirstServer; a match win did not.
  const gameFirstServer = state.winner === null ? other(state.gameFirstServer) : state.gameFirstServer;
  return { ...state, completed, games, game, gameFirstServer, winner: null };
}
