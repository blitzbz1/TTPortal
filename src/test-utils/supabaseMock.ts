// Shared supabase query-chain mock (T070) — previously copy-pasted (~25
// lines) into each service test. Every builder method returns the chain;
// awaiting the chain (or single/maybeSingle) resolves {data, error}.

export interface MockQueryChain {
  [method: string]: jest.Mock | ((resolve: any) => Promise<any>);
}

export function createQueryChain(resolvedData: any = [], resolvedError: any = null): any {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {};
  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'or', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'not',
    'order', 'limit', 'range', 'returns', 'filter',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return chain;
}

/**
 * Standard supabase mock surface. Use with:
 *   const { mockFrom, mockRpc } = supabaseMockFns();
 *   jest.mock('../../lib/supabase', () => ({
 *     supabase: {
 *       from: (...a: any[]) => mockFrom(...a),
 *       rpc: (...a: any[]) => mockRpc(...a),
 *     },
 *   }));
 * (The jest.mock factory itself must stay in the test file — factories may
 * only reference `mock`-prefixed out-of-scope variables.)
 */
export function supabaseMockFns() {
  return {
    mockFrom: jest.fn(),
    mockRpc: jest.fn(),
  };
}
