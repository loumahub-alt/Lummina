import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { v2 as cloudinary } from 'cloudinary';
import { assertProductionConfig, config } from './config.js';
import { connectDatabase } from './db.js';
import { sessionMiddleware, csrf, requireAdmin, requireCsrf, requirePermission, loginAdmin, safeAdmin } from './auth.js';
import { asyncHandler, dataResponse, errorResponse } from './response.js';
import { validate, consultationSchema, newsletterSchema, newsletterTemplateSchema, analyticsEventSchema, consentSchema, contentSchema, adminUserSchema } from './validation.js';
import { ActivityLog, AdminUser, AnalyticsEvent, Consultation, ConsultationNote, ContentRevision, ConsentRecord, FirmStatistic, Media, NewsletterSubscriber, PageSeo, PracticeArea, SiteSetting } from './models.js';
import { archiveContent, deleteContent, getContentResource, listContent, publicContent, saveContent } from './content.js';
import { recordAnalyticsEvent, dashboard } from './analytics.js';
import { logActivity } from './activity.js';

const app = express();
const apiBuild = 'node-express-cms-v2';
const publicResources = ['practice-areas', 'team', 'results', 'insights', 'testimonials', 'statistics'];
const permissions = {
  'practice-areas': 'manage_practice_areas',
  team: 'manage_team',
  results: 'manage_results',
  insights: 'manage_insights',
  testimonials: 'manage_testimonials',
  statistics: 'manage_statistics',
};
const newsletterTemplateKey = 'newsletter_template';
const resendBatchSize = 100;

const resendFrom = () => config.resend.fromName
  ? config.resend.fromName + ' <' + config.resend.fromEmail + '>'
  : config.resend.fromEmail;

const resendClient = () => {
  if (!config.resend.apiKey || !config.resend.fromEmail) return null;
  return new Resend(config.resend.apiKey);
};

const batches = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_value, index) => items.slice(index * size, (index + 1) * size));

// Vercel terminates HTTPS before forwarding requests to Express. Trust its
// proxy in production so secure session cookies are emitted correctly.
app.set('trust proxy', config.app.env === 'production' || process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.app.origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api', (_req, res, next) => {
  // API responses include sessions and live CMS data; they must not be stored
  // by a CDN between requests.
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(sessionMiddleware);

// The traditional server connects before app.listen(). Vercel imports the
// Express app directly, so establish the same database guarantee per warm
// function and reuse the cached Mongoose connection from db.js.
app.use(async (_req, _res, next) => {
  if (config.app.env === 'test') return next();
  try {
    assertProductionConfig();
    await connectDatabase();
    return next();
  } catch (error) {
    return next(error);
  }
});
app.get('/api/health', (_req, res) => res.json({ ok: true, runtime: 'node-express', build: apiBuild }));

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.security.publicRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.security.loginRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const toError = (error) => {
  if (error?.status) return error;
  if (error?.name === 'DocumentNotFoundError') {
    error.status = 404;
    error.message = 'The requested record was not found.';
  }
  if (error?.code === 11000) {
    error.status = 422;
    error.message = 'A record with that unique value already exists.';
  }
  return error;
};

const authRouter = express.Router();
authRouter.get('/csrf', csrf);
authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const remember = Boolean(req.body?.remember);
  if (!email || !password || password.length < 8) return errorResponse(res, 'Email and password are required.', 422);
  const user = await loginAdmin(req, email, password, remember);
  if (!user) return errorResponse(res, 'The provided credentials are invalid.', 422);
  await logActivity({ adminId: user._id, action: 'login', entityType: 'admin_user', entityId: user._id, description: 'Admin logged in.', req });
  return dataResponse(res, safeAdmin(user));
}));
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const adminId = req.session.adminId;
  if (adminId) await logActivity({ adminId, action: 'logout', entityType: 'admin_user', entityId: adminId, description: 'Admin logged out.', req });
  await new Promise((resolve) => req.session.destroy(() => resolve()));
  return dataResponse(res, { loggedOut: true });
}));
authRouter.get('/me', requireAdmin, (req, res) => dataResponse(res, safeAdmin(req.admin)));
app.use('/api/auth', authRouter);

const publicRouter = express.Router();
publicRouter.use(publicLimiter);
publicRouter.get('/site-settings', asyncHandler(async (_req, res) => {
  const records = await SiteSetting.find({ key: { $in: ['contact', 'social', 'legal', 'general'] } }).lean();
  return dataResponse(res, Object.fromEntries(records.map((item) => [item.key, item.value])));
}));
publicRouter.get('/seo/:pageKey', asyncHandler(async (req, res) => {
  const page = await PageSeo.findOne({ pageKey: req.params.pageKey }).orFail();
  return dataResponse(res, { ...page.toJSON(), health: seoHealth(page.toObject()) });
}));
publicRouter.get('/:resource/:slug', asyncHandler(async (req, res) => {
  if (!publicResources.includes(req.params.resource) || !['practice-areas', 'team', 'results', 'insights'].includes(req.params.resource)) return errorResponse(res, 'Not found.', 404);
  return dataResponse(res, await publicContent(req.params.resource, req.params.slug));
}));
publicRouter.get('/:resource', asyncHandler(async (req, res) => {
  if (!publicResources.includes(req.params.resource)) return errorResponse(res, 'Not found.', 404);
  return dataResponse(res, await publicContent(req.params.resource));
}));
publicRouter.post('/consultations', validate(consultationSchema), asyncHandler(async (req, res) => {
  const value = req.validated;
  const reference = 'LUM-CON-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const consultation = await Consultation.create({
    reference,
    client: { firstName: value.firstName, lastName: value.lastName, email: value.email.toLowerCase(), phone: value.phone, company: value.company || null },
    enquiry: { practiceAreaId: value.practiceAreaId, consultationMethod: value.consultationMethod, preferredDate: new Date(value.preferredDate), preferredTime: value.preferredTime, message: value.message },
    consent: { accepted: true, acceptedAt: new Date() },
    status: 'new',
    submittedAt: new Date(),
  });
  return dataResponse(res, { reference: consultation.reference, message: 'Your consultation request has been received.' }, 201);
}));
publicRouter.post('/newsletter', validate(newsletterSchema), asyncHandler(async (req, res) => {
  const value = req.validated;
  const email = value.email.toLowerCase();
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { normalizedEmail: email },
    { $set: { email, normalizedEmail: email, status: 'subscribed', source: value.source, consentedAt: new Date(), unsubscribedAt: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const alreadySubscribed = subscriber.createdAt && subscriber.updatedAt && subscriber.createdAt.getTime() !== subscriber.updatedAt.getTime();
  return dataResponse(res, { subscribed: true, message: alreadySubscribed ? 'This email is already subscribed.' : 'You have been subscribed.' }, alreadySubscribed ? 200 : 201);
}));
publicRouter.post('/analytics/events', validate(analyticsEventSchema), asyncHandler(async (req, res) => {
  const value = req.validated;
  if (!value.consent) return dataResponse(res, { recorded: false });
  await recordAnalyticsEvent({
    ...value,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || '',
  });
  return dataResponse(res, { recorded: true }, 202);
}));
publicRouter.post('/consent', validate(consentSchema), asyncHandler(async (req, res) => {
  await ConsentRecord.findOneAndUpdate({ anonymousId: req.validated.anonymousId }, { $set: { ...req.validated, consentedAt: new Date() } }, { upsert: true, new: true });
  return dataResponse(res, { saved: true });
}));
app.use('/api/public', publicRouter);

const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.use(requireCsrf);
adminRouter.get('/dashboard', requirePermission('view_analytics'), asyncHandler(async (req, res) => dataResponse(res, await dashboard(req.query.days))));

for (const resource of Object.keys(permissions)) {
  const permission = permissions[resource];
  adminRouter.get('/' + resource, requirePermission(permission), asyncHandler(async (req, res) => {
    const result = await listContent(resource, req.query);
    return dataResponse(res, result.items, 200, result.meta);
  }));
  adminRouter.post('/' + resource, requirePermission(permission), validate(contentSchema), asyncHandler(async (req, res) => dataResponse(res, await saveContent(resource, req.validated, req.admin._id, null, req), 201)));
  adminRouter.get('/' + resource + '/:id', requirePermission(permission), asyncHandler(async (req, res) => {
    const [Model] = getContentResource(resource);
    return dataResponse(res, await Model.findById(req.params.id).orFail());
  }));
  adminRouter.patch('/' + resource + '/:id', requirePermission(permission), validate(contentSchema), asyncHandler(async (req, res) => dataResponse(res, await saveContent(resource, req.validated, req.admin._id, req.params.id, req))));
  adminRouter.delete('/' + resource + '/:id/permanent', requirePermission(permission), asyncHandler(async (req, res) => dataResponse(res, await deleteContent(resource, req.params.id, req.admin._id, req))));
  adminRouter.delete('/' + resource + '/:id', requirePermission(permission), asyncHandler(async (req, res) => dataResponse(res, await archiveContent(resource, req.params.id, req.admin._id, req))));
}

adminRouter.get('/consultations', requirePermission('manage_consultations'), asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const perPage = Math.min(Number(req.query.perPage) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    Consultation.find(filter).sort({ submittedAt: -1 }).skip((page - 1) * perPage).limit(perPage),
    Consultation.countDocuments(filter),
  ]);
  return dataResponse(res, items, 200, { currentPage: page, lastPage: Math.max(Math.ceil(total / perPage), 1), total });
}));
adminRouter.get('/consultations/:id', requirePermission('manage_consultations'), asyncHandler(async (req, res) => dataResponse(res, { consultation: await Consultation.findById(req.params.id).orFail(), notes: await ConsultationNote.find({ consultationId: req.params.id }).sort({ createdAt: -1 }) })));
adminRouter.patch('/consultations/:id', requirePermission('manage_consultations'), asyncHandler(async (req, res) => {
  const allowed = ['new', 'reviewing', 'contacted', 'scheduled', 'completed', 'closed'];
  if (req.body.status && !allowed.includes(req.body.status)) return errorResponse(res, 'Invalid consultation status.', 422);
  const consultation = await Consultation.findById(req.params.id).orFail();
  const old = consultation.toObject();
  if (req.body.status) consultation.status = req.body.status;
  if (req.body.assignedTo !== undefined) consultation.assignedTo = req.body.assignedTo;
  await consultation.save();
  await logActivity({ adminId: req.admin._id, action: 'updated', entityType: 'consultation', entityId: consultation._id, description: 'Updated consultation status or assignment.', oldValues: old, newValues: consultation.toObject(), req });
  return dataResponse(res, consultation);
}));
adminRouter.post('/consultations/:id/notes', requirePermission('manage_consultations'), asyncHandler(async (req, res) => {
  if (!String(req.body.note ?? '').trim()) return errorResponse(res, 'Note is required.', 422);
  await Consultation.findById(req.params.id).orFail();
  return dataResponse(res, await ConsultationNote.create({ consultationId: req.params.id, adminId: String(req.admin._id), note: String(req.body.note).trim() }), 201);
}));

adminRouter.get('/newsletter', requirePermission('manage_newsletter'), asyncHandler(async (req, res) => {
  const perPage = Math.min(Number(req.query.perPage) || 50, 100);
  const items = await NewsletterSubscriber.find().sort({ createdAt: -1 }).limit(perPage);
  return dataResponse(res, items, 200, { total: await NewsletterSubscriber.countDocuments() });
}));
adminRouter.get('/newsletter/template', requirePermission('manage_newsletter'), asyncHandler(async (_req, res) => {
  const setting = await SiteSetting.findOne({ key: newsletterTemplateKey }).lean();
  return dataResponse(res, {
    subject: String(setting?.value?.subject ?? ''),
    html: String(setting?.value?.html ?? ''),
    updatedAt: setting?.updatedAt ?? null,
  });
}));
adminRouter.put('/newsletter/template', requirePermission('manage_newsletter'), validate(newsletterTemplateSchema), asyncHandler(async (req, res) => {
  const value = req.validated;
  if (/<script\b|\bon[a-z]+\s*=|javascript:/i.test(value.html)) return errorResponse(res, 'The newsletter template contains blocked script or event-handler markup.', 422);
  const setting = await SiteSetting.findOneAndUpdate(
    { key: newsletterTemplateKey },
    { $set: { key: newsletterTemplateKey, value, updatedBy: String(req.admin._id) } },
    { upsert: true, new: true },
  );
  await logActivity({ adminId: req.admin._id, action: 'updated', entityType: 'newsletter_template', entityId: setting._id, description: 'Updated the newsletter template.', req });
  return dataResponse(res, { subject: value.subject, html: value.html, updatedAt: setting.updatedAt });
}));
adminRouter.post('/newsletter/send', requirePermission('manage_newsletter'), asyncHandler(async (req, res) => {
  const setting = await SiteSetting.findOne({ key: newsletterTemplateKey }).lean();
  const template = newsletterTemplateSchema.safeParse(setting?.value ?? {});
  if (!template.success) return errorResponse(res, 'Save a newsletter subject and HTML template before sending.', 422);
  const resend = resendClient();
  if (!resend) return errorResponse(res, 'Resend is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the backend environment.', 503);

  const recipients = (await NewsletterSubscriber.find({ status: 'subscribed' }).select('email -_id').lean())
    .map((item) => String(item.email ?? '').trim().toLowerCase())
    .filter(Boolean);
  const recipientBatches = batches([...new Set(recipients)], resendBatchSize);
  const sentIds = [];
  for (const recipientBatch of recipientBatches) {
    const result = await resend.batch.send(recipientBatch.map((email) => ({
      from: resendFrom(),
      to: [email],
      subject: template.data.subject,
      html: template.data.html,
    })));
    if (result.error) {
      const error = new Error(result.error.message || 'Resend could not send the newsletter.');
      error.status = 502;
      throw error;
    }
    sentIds.push(...(result.data ?? []).map((item) => item.id));
  }
  await logActivity({ adminId: req.admin._id, action: 'sent', entityType: 'newsletter', description: 'Sent a newsletter to ' + sentIds.length + ' subscribed recipients.', newValues: { recipients: sentIds.length, batches: recipientBatches.length }, req });
  return dataResponse(res, { sent: sentIds.length, recipients: [...new Set(recipients)].length, batches: recipientBatches.length });
}));
adminRouter.get('/settings/:key', requirePermission('manage_site_settings'), asyncHandler(async (req, res) => dataResponse(res, await SiteSetting.findOne({ key: req.params.key }))));
adminRouter.put('/settings/:key', requirePermission('manage_site_settings'), asyncHandler(async (req, res) => {
  if (!req.body.value || typeof req.body.value !== 'object' || Array.isArray(req.body.value)) return errorResponse(res, 'Settings value must be an object.', 422);
  const setting = await SiteSetting.findOneAndUpdate({ key: req.params.key }, { $set: { key: req.params.key, value: req.body.value, updatedBy: String(req.admin._id) } }, { upsert: true, new: true });
  await logActivity({ adminId: req.admin._id, action: 'updated', entityType: 'site_setting', entityId: setting._id, description: 'Updated ' + req.params.key + ' site settings.', req });
  return dataResponse(res, setting);
}));
adminRouter.get('/seo', requirePermission('manage_seo'), asyncHandler(async (_req, res) => {
  const items = await PageSeo.find().sort({ pageKey: 1 });
  return dataResponse(res, items.map((item) => ({ ...item.toJSON(), health: seoHealth(item.toObject()) })));
}));
adminRouter.put('/seo/:pageKey', requirePermission('manage_seo'), asyncHandler(async (req, res) => {
  const allowed = ['seoTitle', 'metaDescription', 'canonicalUrl', 'ogTitle', 'ogDescription', 'ogImageId', 'socialImageId', 'indexable', 'structuredData'];
  const value = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (value.canonicalUrl && !/^https?:\/\//.test(value.canonicalUrl)) return errorResponse(res, 'canonicalUrl must be a valid URL.', 422);
  const page = await PageSeo.findOneAndUpdate({ pageKey: req.params.pageKey }, { $set: { ...value, pageKey: req.params.pageKey, updatedBy: String(req.admin._id) } }, { upsert: true, new: true });
  return dataResponse(res, { ...page.toJSON(), health: seoHealth(page.toObject()) });
}));
adminRouter.get('/activity', requirePermission('view_activity_logs'), asyncHandler(async (req, res) => {
  const items = await ActivityLog.find().sort({ createdAt: -1 }).limit(Math.min(Number(req.query.perPage) || 50, 100));
  return dataResponse(res, items);
}));
adminRouter.get('/users', requirePermission('manage_admins'), asyncHandler(async (_req, res) => dataResponse(res, await AdminUser.find().sort({ lastName: 1 }))));
adminRouter.post('/users', requirePermission('manage_admins'), asyncHandler(async (req, res) => {
  const value = adminUserSchema(false).parse(req.body);
  value.email = value.email.toLowerCase();
  if (await AdminUser.exists({ email: value.email })) return errorResponse(res, 'An admin account already exists for this email.', 422, { email: ['This email is already in use.'] });
  value.password = await bcrypt.hash(value.password, 12);
  const user = await AdminUser.create(value);
  await logActivity({ adminId: req.admin._id, action: 'created', entityType: 'admin_user', entityId: user._id, description: 'Created an admin account.', newValues: { email: user.email, role: user.role }, req });
  return dataResponse(res, safeAdmin(user), 201);
}));
adminRouter.patch('/users/:id', requirePermission('manage_admins'), asyncHandler(async (req, res) => {
  const value = adminUserSchema(true).parse(req.body);
  const user = await AdminUser.findById(req.params.id).orFail();
  if (value.email) value.email = value.email.toLowerCase();
  if (value.email && await AdminUser.exists({ email: value.email, _id: { $ne: user._id } })) return errorResponse(res, 'An admin account already exists for this email.', 422);
  if (value.password) value.password = await bcrypt.hash(value.password, 12);
  else delete value.password;
  Object.assign(user, value);
  await user.save();
  return dataResponse(res, safeAdmin(user));
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)),
});
const safeName = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'upload';
const cloudinaryConfigured = () => Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
const configureCloudinary = () => cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});
const uploadToCloudinary = (buffer, options) => new Promise((resolve, reject) => {
  configureCloudinary();
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) return reject(error);
    return resolve(result);
  });
  stream.end(buffer);
});
const validImageBytes = (buffer, mime) => {
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return false;
};
adminRouter.post('/media', requirePermission('manage_media'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 'A valid image or document is required.', 422);
  if (req.file.mimetype.startsWith('image/') && !validImageBytes(req.file.buffer, req.file.mimetype)) return errorResponse(res, 'The uploaded image could not be verified.', 422);
  if (!cloudinaryConfigured()) return errorResponse(res, 'Cloudinary is not configured for media uploads.', 503);
  const type = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
  const extension = req.file.originalname.includes('.') ? req.file.originalname.split('.').pop().toLowerCase() : 'bin';
  const folder = config.cloudinary.folder + '/' + (type === 'image' ? 'images' : 'documents');
  const baseName = safeName(req.file.originalname.replace(/\.[^/.]+$/, '')) + '-' + crypto.randomBytes(6).toString('hex');
  const publicId = type === 'document' ? baseName + '.' + extension : baseName;
  const uploadOptions = {
    folder,
    public_id: publicId,
    resource_type: type === 'image' ? 'image' : 'raw',
    type: 'upload',
  };
  if (req.body.altText) uploadOptions.context = { alt: String(req.body.altText) };
  const result = await uploadToCloudinary(req.file.buffer, uploadOptions);
  const media = await Media.create({
    type,
    originalName: req.file.originalname,
    storage: {
      provider: 'cloudinary',
      publicId: result.public_id,
      key: result.public_id,
      resourceType: result.resource_type,
      deliveryType: result.type,
      version: result.version,
      format: result.format,
      url: result.secure_url,
    },
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    width: result.width,
    height: result.height,
    altText: req.body.altText,
    uploadedBy: String(req.admin._id),
  });
  return dataResponse(res, { ...media.toJSON(), url: result.secure_url }, 201);
}));
adminRouter.delete('/media/:id', requirePermission('manage_media'), asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id).orFail();
  if (!cloudinaryConfigured()) return errorResponse(res, 'Cloudinary is not configured for media deletion.', 503);
  const publicId = media.storage?.publicId ?? media.storage?.key;
  if (publicId) {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: media.storage?.resourceType ?? (media.type === 'image' ? 'image' : 'raw'),
      type: media.storage?.deliveryType ?? 'upload',
      invalidate: true,
    });
  }
  await media.deleteOne();
  return dataResponse(res, { deleted: true });
}));
app.use('/api/admin', adminRouter);

function seoHealth(page) {
  const checks = [
    ['title', Boolean(page.seoTitle && page.seoTitle.length >= 30 && page.seoTitle.length <= 65)],
    ['description', Boolean(page.metaDescription && page.metaDescription.length >= 70 && page.metaDescription.length <= 160)],
    ['canonical', Boolean(page.canonicalUrl)],
    ['openGraph', Boolean(page.ogTitle && page.ogDescription)],
    ['socialImage', Boolean(page.ogImageId || page.socialImageId)],
    ['structuredData', Boolean(page.structuredData)],
    ['indexable', page.indexable !== false],
  ];
  const passed = checks.filter(([, value]) => value).length;
  return { score: Math.round((passed / checks.length) * 100), checks: Object.fromEntries(checks) };
}

app.use((error, _req, res, _next) => {
  const normalized = toError(error);
  if (normalized?.name === 'ZodError') return errorResponse(res, 'The given data was invalid.', 422);
  if (normalized?.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Files must be 10MB or smaller.', 422);
  if (normalized?.message === 'Origin is not allowed by CORS.') return errorResponse(res, normalized.message, 403);
  console.error(normalized);
  return errorResponse(res, config.app.env === 'production' ? 'The request could not be completed.' : normalized.message, normalized.status ?? 500);
});

export { app };
export default app;
