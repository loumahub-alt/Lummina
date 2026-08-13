import mongoose from 'mongoose';
import { config } from './config.js';

// Reuse the same connection across warm serverless invocations. This also
// prevents concurrent requests from opening duplicate MongoDB connections.
let connectionPromise;

export const connectDatabase = async () => {
  if (!config.mongo.uri) {
    throw new Error('MONGODB_URI is required before connecting to MongoDB.');
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  // Content models intentionally use flexible fields. Keep query filters such
  // as slug, value, label, pageKey, and clientDisplayName intact.
  mongoose.set('strictQuery', false);
  connectionPromise = mongoose.connect(config.mongo.uri, {
    dbName: config.mongo.database,
    appName: 'Lummina Law Firm',
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 5000),
  }).then(() => mongoose.connection).catch((error) => {
    connectionPromise = undefined;
    throw error;
  });

  return connectionPromise;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  connectionPromise = undefined;
};
