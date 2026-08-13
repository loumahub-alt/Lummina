import crypto from 'node:crypto';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bcrypt from 'bcryptjs';
import { AdminUser } from './models.js';
import { config } from './config.js';
import { errorResponse } from './response.js';

export const sessionMiddleware = session({
  name: process.env.SESSION_COOKIE ?? 'lummina-session',
  secret: config.session.secret || 'development-only-session-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    maxAge: config.session.maxAge,
  },
  store: config.mongo.uri && config.app.env !== 'test'
    ? MongoStore.create({ mongoUrl: config.mongo.uri, dbName: config.mongo.database, collectionName: 'sessions' })
    : undefined,
});

export const csrf = (req, res) => {
  req.session.csrfToken ??= crypto.randomBytes(32).toString('hex');
  return res.json({ data: { token: req.session.csrfToken } });
};

export const requireCsrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('X-CSRF-TOKEN') ?? req.get('X-XSRF-TOKEN');
  if (!supplied || supplied !== req.session.csrfToken) {
    return errorResponse(res, 'CSRF token mismatch.', 419);
  }
  return next();
};

export const requireAdmin = async (req, res, next) => {
  if (!req.session.adminId) return errorResponse(res, 'Authentication required.', 401);
  const user = await AdminUser.findById(req.session.adminId);
  if (!user || !user.isActive) {
    delete req.session.adminId;
    return errorResponse(res, 'This admin account is inactive.', 403);
  }
  req.admin = user;
  return next();
};

export const requirePermission = (permission) => (req, res, next) => {
  const user = req.admin;
  if (!user || (user.role !== 'super_admin' && !user.permissions.includes('*') && !user.permissions.includes(permission))) {
    return errorResponse(res, 'You do not have permission to perform this action.', 403);
  }
  return next();
};

export const safeAdmin = (user) => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  name: [user.firstName, user.lastName].filter(Boolean).join(' '),
  email: user.email,
  role: user.role,
  permissions: user.permissions ?? [],
  isActive: Boolean(user.isActive),
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
});

export const loginAdmin = async (req, email, password, remember) => {
  const user = await AdminUser.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) return null;
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.adminId = String(user._id);
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  if (remember) req.session.cookie.maxAge = config.session.maxAge * 7;
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();
  return user;
};
