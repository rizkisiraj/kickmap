// Module-level Mongo connection pool gauges.
//
// Kept separate from src/db/connection.ts so that src/instrumentation.ts can
// read the current gauge values without importing db/connection.ts (which
// would risk pulling in Mongoose/connect side effects into the process-tick
// interval). db/connection.ts writes to these on CMAP pool events;
// instrumentation.ts only reads via getPoolStats().

interface PoolStats {
  // MAX_POOL_SIZE (src/db/connection.ts) is per-host, not cluster-wide — the
  // driver maintains a separate pool per server (Atlas is a replica set, so
  // 3 data-bearing pools plus monitor connections). poolInUse aggregates
  // in-use connections across ALL of those pools, so a healthy reading can
  // legitimately exceed poolSize (e.g. poolInUse: 60 / poolSize: 50 across 3
  // hosts is fine — it is not a bug). Treat poolSize as "per-pool ceiling",
  // not "total capacity".
  poolSize: number;
}

// The MongoDB driver's connection id is `number | '<monitor>'`.
type ConnectionId = number | string;

// IMPORTANT: connectionId is only unique WITHIN a single server's pool — the
// driver numbers connections per-pool starting from 1, so connection id `1`
// exists simultaneously on every replica set member. A Set keyed on the bare
// connectionId collapses concurrent checkouts on different hosts into one
// entry (undercount), and a checkedIn on host B can delete the entry that
// host A's still-checked-out connection depends on (further undercount). Do
// not simplify this back to a bare connectionId — always key on
// `${address}:${connectionId}` where address is the event's `host:port`.
const buildKey = (address: string, connectionId: ConnectionId): string => `${address}:${connectionId}`;

// poolInUse is derived from the size of a Set of currently-checked-out
// connection keys, rather than a bare incremented/decremented counter. A
// connection can be closed while checked out (network error, server-side
// kill) or the whole pool can be torn down — both emit events with no
// matching connectionCheckedIn. A bare counter only ratchets up in that case
// (Math.max(0, ...) only guards the low side); a Set self-corrects because
// connectionClosed removes the key whether or not it was ever checked in.
const globalForPoolStats = globalThis as typeof globalThis & {
  poolStats?: PoolStats;
  poolInUseKeys?: Set<string>;
};

const stats: PoolStats = globalForPoolStats.poolStats ?? { poolSize: 0 };
const inUseKeys: Set<string> = globalForPoolStats.poolInUseKeys ?? new Set();

if (!globalForPoolStats.poolStats) {
  globalForPoolStats.poolStats = stats;
}
if (!globalForPoolStats.poolInUseKeys) {
  globalForPoolStats.poolInUseKeys = inUseKeys;
}

export const markConnectionCheckedOut = (address: string, connectionId: ConnectionId): void => {
  inUseKeys.add(buildKey(address, connectionId));
};

export const markConnectionCheckedIn = (address: string, connectionId: ConnectionId): void => {
  inUseKeys.delete(buildKey(address, connectionId));
};

// A connection closing (network error, server-side kill) frees its slot
// whether or not a matching check-in was ever emitted.
export const markConnectionClosed = (address: string, connectionId: ConnectionId): void => {
  inUseKeys.delete(buildKey(address, connectionId));
};

// The pool is being torn down — nothing is meaningfully "in use" anymore.
export const resetPoolInUse = (): void => {
  inUseKeys.clear();
};

export const setPoolSize = (size: number): void => {
  stats.poolSize = size;
};

export const getPoolStats = (): { poolInUse: number; poolSize: number } => ({
  poolInUse: inUseKeys.size,
  poolSize: stats.poolSize,
});
