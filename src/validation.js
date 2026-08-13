import { z } from 'zod';

const futureDate = z.string().refine((value) => {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date > new Date();
}, 'Preferred date must be in the future.');

export const consultationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(3).max(50),
  company: z.string().trim().max(200).optional().or(z.literal('')),
  practiceAreaId: z.string().trim().min(1).max(200),
  consultationMethod: z.enum(['In-person meeting', 'Video call', 'Phone call']),
  preferredDate: futureDate,
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Preferred time must use HH:MM format.'),
  message: z.string().trim().min(1).max(10000),
  consent: z.literal(true),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(200),
  source: z.string().trim().max(100).optional().default('website'),
  consent: z.literal(true),
});

export const newsletterTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  html: z.string().trim().min(1).max(900000),
});

const events = [
  'page_view', 'practice_area_view', 'team_profile_view', 'insight_view',
  'consultation_cta_click', 'consultation_started', 'consultation_submitted',
  'whatsapp_click', 'phone_click', 'phone_tap', 'email_click', 'site_search',
  'search_result_click', 'form_submit', 'newsletter_signup', 'book_redirect_click',
];

export const analyticsEventSchema = z.object({
  event: z.enum(events),
  sessionId: z.string().max(128).optional(),
  visitorId: z.string().max(128).optional(),
  page: z.string().max(500).optional(),
  entity: z.record(z.string(), z.unknown()).optional(),
  source: z.record(z.string(), z.unknown()).optional(),
  device: z.record(z.string(), z.unknown()).optional(),
  country: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  occurredAt: z.coerce.date().optional(),
  consent: z.boolean().optional().default(false),
});

export const consentSchema = z.object({
  anonymousId: z.string().min(1).max(128),
  necessary: z.boolean(),
  analytics: z.boolean(),
  preferences: z.boolean(),
  marketing: z.boolean(),
  policyVersion: z.string().max(40),
});

const contentAssetSchema = z.object({
  // Seeded team photos may use a site-relative path, while uploaded assets
  // use an absolute Cloudinary URL.
  url: z.string().trim().min(1).max(2048).refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return value.startsWith('/') && !value.startsWith('//');
    }
  }, 'Asset URL must be a valid URL or site-relative path.'),
  mediaId: z.string().trim().max(200).optional().default(''),
  alt: z.string().trim().max(300).optional().default(''),
}).passthrough();

const contactSchema = z.object({
  email: z.string().trim().max(200).optional().default(''),
  linkedin: z.string().trim().max(2048).optional().default(''),
}).passthrough();
const teamListSchema = z.array(z.string().trim().max(500)).optional();

export const contentSchema = z.object({
  title: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  fullName: z.string().max(200).optional(),
  clientDisplayName: z.string().max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  position: z.string().max(300).optional(),
  testimonial: z.string().max(10000).optional(),
  icon: z.string().max(50).optional(),
  shortBio: z.string().max(1000).optional(),
  contact: contactSchema.optional(),
  location: z.string().trim().max(200).optional(),
  practiceInterests: teamListSchema,
  education: teamListSchema,
  admissions: teamListSchema,
  // Admin forms may send the human-readable title as the slug. saveContent
  // normalizes it to a URL-safe slug after validation.
  slug: z.string().max(220).optional(),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  services: z.array(z.unknown()).optional(),
  image: contentAssetSchema.optional(),
  thumbnail: contentAssetSchema.optional(),
  photo: contentAssetSchema.optional(),
  seo: z.record(z.string(), z.unknown()).optional(),
  consentConfirmed: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  matterDescription: z.string().max(10000).optional(),
  identityMode: z.enum(['anonymous', 'named']).optional(),
  isFeatured: z.boolean().optional(),
  value: z.string().max(200).optional(),
  label: z.string().max(300).optional(),
  supportingText: z.string().max(2000).optional(),
  verifiedAt: z.coerce.date().nullable().optional(),
}).passthrough();

export const adminUserSchema = (partial = false) => z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  password: partial ? z.string().min(12).nullable().optional() : z.string().min(12),
  role: z.enum(['super_admin', 'content_editor', 'consultation_manager', 'analyst']).optional(),
  permissions: z.array(z.string().max(100)).optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'request';
      errors[key] ??= [];
      errors[key].push(issue.message);
    }
    return res.status(422).json({ message: 'The given data was invalid.', errors });
  }
  req.validated = result.data;
  return next();
};
