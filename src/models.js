import mongoose from 'mongoose';

const { Schema } = mongoose;

const documentOptions = {
  strict: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    transform: (_document, ret) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

const documentSchema = (definition = {}) => new Schema(definition, documentOptions);
const model = (name, collection, definition = {}) => mongoose.model(name, documentSchema(definition), collection);
const contentAssetSchema = new Schema({
  url: { type: String, trim: true },
  mediaId: { type: String, trim: true },
  alt: { type: String, trim: true },
}, { _id: false, strict: false });
const contactSchema = new Schema({
  email: { type: String, trim: true, default: '' },
  linkedin: { type: String, trim: true, default: '' },
}, { _id: false, strict: false });

export const AdminUser = mongoose.model('AdminUser', documentSchema({
  firstName: String,
  lastName: String,
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, default: 'content_editor' },
  permissions: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  twoFactorEnabled: { type: Boolean, default: false },
  lastLoginAt: Date,
  lastLoginIp: String,
}), 'admin_users');
AdminUser.schema.index({ email: 1 }, { unique: true });
AdminUser.schema.set('toJSON', {
  transform: (_document, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

export const PracticeArea = model('PracticeArea', 'practice_areas', {
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  shortDescription: { type: String, required: true },
  fullDescription: { type: String, required: true },
  services: { type: [Schema.Types.Mixed], default: [] },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
PracticeArea.schema.index({ slug: 1 }, { unique: true });
PracticeArea.schema.index({ status: 1, displayOrder: 1 });

export const TeamMember = model('TeamMember', 'team_members', {
  fullName: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  displayOrder: { type: Number, default: 0 },
  location: { type: String, trim: true, default: '' },
  shortBio: { type: String, default: '' },
  fullBio: { type: String, required: true },
  practiceInterests: { type: [String], default: [] },
  education: { type: [String], default: [] },
  admissions: { type: [String], default: [] },
  contact: { type: contactSchema, default: undefined },
  photo: { type: contentAssetSchema, default: undefined },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
TeamMember.schema.index({ slug: 1 }, { unique: true });
TeamMember.schema.index({ status: 1, displayOrder: 1 });

export const Result = model('Result', 'results', {
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  headlineFigure: { type: String, required: true },
  category: { type: String, required: true },
  shortDescription: { type: String, required: true },
  matterDescription: { type: String, default: '' },
  jurisdiction: { type: String, trim: true, default: '' },
  displayOrder: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
Result.schema.index({ slug: 1 }, { unique: true });
Result.schema.index({ status: 1, publishedAt: -1 });

export const Insight = model('Insight', 'insights', {
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  image: { type: contentAssetSchema, default: undefined },
  thumbnail: { type: contentAssetSchema, default: undefined },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
Insight.schema.index({ slug: 1 }, { unique: true });
Insight.schema.index({ status: 1, publishedAt: -1 });
Insight.schema.index({ type: 1, status: 1 });

export const Testimonial = model('Testimonial', 'testimonials', {
  clientDisplayName: { type: String, required: true, trim: true },
  company: { type: String, trim: true, default: '' },
  position: { type: String, required: true, trim: true },
  testimonial: { type: String, required: true },
  identityMode: { type: String, enum: ['anonymous', 'named'], default: 'anonymous' },
  consentConfirmed: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
Testimonial.schema.index({ status: 1, isFeatured: -1, displayOrder: 1 });

export const FirmStatistic = model('FirmStatistic', 'firm_statistics', {
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  supportingText: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
});
FirmStatistic.schema.index({ status: 1, displayOrder: 1 });

export const Consultation = model('Consultation', 'consultations');
Consultation.schema.index({ reference: 1 }, { unique: true });
Consultation.schema.index({ status: 1, submittedAt: -1 });
Consultation.schema.index({ assignedTo: 1, status: 1 });

export const ConsultationNote = model('ConsultationNote', 'consultation_notes');
ConsultationNote.schema.index({ consultationId: 1, createdAt: -1 });

export const NewsletterSubscriber = model('NewsletterSubscriber', 'newsletter_subscribers');
NewsletterSubscriber.schema.index({ normalizedEmail: 1 }, { unique: true });

export const PageSeo = model('PageSeo', 'page_seo', {
  pageKey: { type: String, required: true, trim: true },
  seoTitle: String,
  metaDescription: String,
  canonicalUrl: String,
  ogTitle: String,
  ogDescription: String,
  ogImageId: String,
  socialImageId: String,
  indexable: { type: Boolean, default: true },
  structuredData: Schema.Types.Mixed,
  updatedBy: String,
});
PageSeo.schema.index({ pageKey: 1 }, { unique: true });

export const SiteSetting = model('SiteSetting', 'site_settings', {
  key: { type: String, required: true, trim: true },
  value: { type: Schema.Types.Mixed, default: {} },
  updatedBy: String,
});
SiteSetting.schema.index({ key: 1 }, { unique: true });

export const Media = model('Media', 'media');
Media.schema.index({ 'storage.key': 1 }, { unique: true });

export const AnalyticsEvent = model('AnalyticsEvent', 'analytics_events', {
  event: { type: String, required: true },
  visitorId: String,
  sessionId: String,
  ipAddress: String,
  userAgent: String,
});
AnalyticsEvent.schema.index({ occurredAt: -1 });
AnalyticsEvent.schema.index({ event: 1, occurredAt: -1 });
AnalyticsEvent.schema.index({ page: 1, occurredAt: -1 });
AnalyticsEvent.schema.index({ sessionId: 1, occurredAt: -1 });
AnalyticsEvent.schema.index({ visitorId: 1, occurredAt: -1 });

export const AnalyticsDailyPage = model('AnalyticsDailyPage', 'analytics_daily_pages');
AnalyticsDailyPage.schema.index({ date: -1, page: 1 }, { unique: true });

export const AnalyticsDailyPracticeArea = model('AnalyticsDailyPracticeArea', 'analytics_daily_practice_areas');
AnalyticsDailyPracticeArea.schema.index({ date: -1, practiceAreaId: 1 }, { unique: true });

export const SearchQuery = model('SearchQuery', 'search_queries', {
  query: { type: String, required: true, trim: true },
  normalizedQuery: { type: String, required: true, trim: true },
  searchId: { type: String, trim: true, default: '' },
  resultCount: { type: Number, default: 0 },
  clickedResult: { type: String, default: null },
  clickCount: { type: Number, default: 0 },
  searchedAt: { type: Date, default: Date.now },
});
SearchQuery.schema.index({ normalizedQuery: 1, searchedAt: -1 });
SearchQuery.schema.index({ searchId: 1 });

export const ConsentRecord = model('ConsentRecord', 'consent_records', {
  anonymousId: { type: String, required: true, trim: true },
  necessary: { type: Boolean, default: true },
  analytics: { type: Boolean, default: false },
  preferences: { type: Boolean, default: false },
  marketing: { type: Boolean, default: false },
  policyVersion: { type: String, required: true, trim: true },
  consentedAt: { type: Date, default: Date.now },
});
ConsentRecord.schema.index({ anonymousId: 1 }, { unique: true });

export const ActivityLog = model('ActivityLog', 'activity_logs');
ActivityLog.schema.index({ adminId: 1, createdAt: -1 });
ActivityLog.schema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const ContentRevision = model('ContentRevision', 'content_revisions');
ContentRevision.schema.index({ entityType: 1, entityId: 1, version: -1 });

export const Redirect = model('Redirect', 'redirects');
Redirect.schema.index({ from: 1 }, { unique: true });

export const contentModels = {
  'practice-areas': [PracticeArea, 'practice_area'],
  team: [TeamMember, 'team_member'],
  results: [Result, 'result'],
  insights: [Insight, 'insight'],
  testimonials: [Testimonial, 'testimonial'],
  statistics: [FirmStatistic, 'firm_statistic'],
};

export const allModels = [
  AdminUser, PracticeArea, TeamMember, Result, Insight, Testimonial, FirmStatistic,
  Consultation, ConsultationNote, NewsletterSubscriber, PageSeo, SiteSetting, Media,
  AnalyticsEvent, AnalyticsDailyPage, AnalyticsDailyPracticeArea, SearchQuery,
  ConsentRecord, ActivityLog, ContentRevision, Redirect,
];

export const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value.toJSON === 'function') return value.toJSON();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
};
