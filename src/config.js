import dotenv from 'dotenv';

const loadedEnv = dotenv.config().parsed ?? {};
const envValue = (key, fallback = '') => {
  const runtimeValue = process.env[key];
  return runtimeValue && runtimeValue.trim() ? runtimeValue : loadedEnv[key] ?? fallback;
};

const csv = (value, fallback = '') => String(value ?? fallback)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

export const config = {
  app: {
    env: envValue('NODE_ENV', 'development'),
    port: Number(envValue('PORT', '8000')),
    url: envValue('APP_URL', 'http://localhost:8000'),
    frontendUrl: envValue('FRONTEND_URL', 'http://localhost:5173'),
    origins: csv(envValue('CORS_ALLOWED_ORIGINS'), envValue('FRONTEND_URL', 'http://localhost:5173')),
  },
  mongo: {
    uri: envValue('MONGODB_URI'),
    database: envValue('MONGODB_DATABASE', 'lummina'),
  },
  session: {
    secret: envValue('SESSION_SECRET'),
    secure: envValue('SESSION_SECURE_COOKIE') === 'true',
    sameSite: envValue('SESSION_SAME_SITE', 'lax'),
    maxAge: Number(envValue('SESSION_LIFETIME_MINUTES', '120')) * 60 * 1000,
  },
  security: {
    publicRateLimit: Number(envValue('RATE_LIMIT_PUBLIC', '60')),
    loginRateLimit: Number(envValue('RATE_LIMIT_LOGIN', '5')),
  },
  cloudinary: {
    cloudName: envValue('CLOUDINARY_CLOUD_NAME'),
    apiKey: envValue('CLOUDINARY_API_KEY'),
    apiSecret: envValue('CLOUDINARY_API_SECRET'),
    folder: envValue('CLOUDINARY_FOLDER', 'lummina'),
  },
  resend: {
    apiKey: envValue('RESEND_API_KEY'),
    fromEmail: envValue('RESEND_FROM_EMAIL'),
    fromName: envValue('RESEND_FROM_NAME'),
  },
};

export const isProduction = config.app.env === 'production';

export const assertProductionConfig = () => {
  if (!isProduction) return;
  const required = [
    ['MONGODB_URI', config.mongo.uri],
    ['SESSION_SECRET', config.session.secret],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error('Missing production configuration: ' + missing.join(', '));
};
