import mongoose from 'mongoose';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';
import {
  markConnectionCheckedOut,
  markConnectionCheckedIn,
  markConnectionClosed,
  resetPoolInUse,
  setPoolSize,
} from '@/lib/pool-stats';

const log = createLogger('mongodb');

const MAX_POOL_SIZE = 50;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  poolListenersAttached: boolean;
}

// Prevent connection exhaustion during Next.js hot reloads
const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached: MongooseCache =
  globalWithMongoose.mongooseCache ?? { conn: null, promise: null, poolListenersAttached: false };

if (!globalWithMongoose.mongooseCache) {
  globalWithMongoose.mongooseCache = cached;
}

mongoose.connection.on('connected', () => {
  log.info('MongoDB connected');
});

mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
mongoose.connection.on('error', (err) => log.error({ err: err.message }, 'MongoDB connection error'));

export const connectDB = async (): Promise<typeof mongoose> => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    log.info('Initializing MongoDB connection...');
    cached.promise = mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: MAX_POOL_SIZE,
      minPoolSize: 5,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;

  if (!cached.poolListenersAttached) {
    cached.poolListenersAttached = true;
    setPoolSize(MAX_POOL_SIZE);

    const client = cached.conn.connection.getClient();

    client.on('connectionPoolCleared', () => {
      log.error('Mongo pool cleared');
      // Pool is being torn down — nothing is meaningfully "in use" anymore.
      // Without this, connections dropped mid-teardown never emit a matching
      // checkedIn and the gauge would ratchet upward permanently.
      resetPoolInUse();
    });
    client.on('connectionCheckOutFailed', (e) => log.error({ reason: e.reason }, 'Pool checkout failed'));

    // Gauges only — per-event logging at load would flood Loki (thousands/sec).
    // poolInUse is the size of a Set of checked-out connections, keyed on
    // `address:connectionId` (see pool-stats.ts) rather than a bare counter
    // or bare connectionId. The driver numbers connections per-pool starting
    // from 1, and Atlas is a replica set (one pool per member), so
    // connectionId alone collides across hosts — address must be included.
    // The Set also self-corrects: a connection closing while checked out
    // (network error, server-side kill) still frees its slot via
    // connectionClosed even with no matching checkedIn.
    client.on('connectionCheckedOut', (e) => markConnectionCheckedOut(e.address, e.connectionId));
    client.on('connectionCheckedIn', (e) => markConnectionCheckedIn(e.address, e.connectionId));
    client.on('connectionClosed', (e) => markConnectionClosed(e.address, e.connectionId));
  }

  return cached.conn;
};
