import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * True when MONGODB_URI is set in the environment.
 * API routes use this to short-circuit and return an empty payload
 * (instead of crashing) when the optional off-chain audit DB isn't configured.
 */
export const isMongoConfigured = (): boolean => Boolean(MONGODB_URI);

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    // Lazy throw so simply importing this module never crashes the route.
    throw new Error(
      'MONGODB_URI is not set — off-chain audit storage is disabled. ' +
        'Set MONGODB_URI in ui/.env.local to enable persistence.'
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance: typeof mongoose) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
