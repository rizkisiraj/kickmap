import mongoose from 'mongoose';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('mongodb');

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Prevent connection exhaustion during Next.js hot reloads
const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose.mongooseCache ?? { conn: null, promise: null };

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
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};
