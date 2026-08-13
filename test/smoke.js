import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { analyticsEventSchema, consultationSchema, contentSchema, newsletterSchema, newsletterTemplateSchema } from '../src/validation.js';
import { ConsentRecord, FirmStatistic, Insight, PracticeArea, Result, SearchQuery, TeamMember, Testimonial, contentModels } from '../src/models.js';

assert.equal(typeof app, 'function');
assert.equal(consultationSchema.safeParse({}).success, false);
assert.equal(newsletterSchema.safeParse({ email: 'not-an-email', consent: true }).success, false);
assert.equal(newsletterTemplateSchema.safeParse({ subject: 'Firm update', html: '<p>News</p>' }).success, true);
assert.equal(newsletterTemplateSchema.safeParse({ subject: '', html: '<p>News</p>' }).success, false);
assert.equal(analyticsEventSchema.safeParse({ event: 'page_view', consent: false }).success, true);
assert.equal(contentSchema.safeParse({ title: 'Real Estate & Property', slug: 'Real Estate & Property', icon: 'building', shortBio: 'A short team profile.', contact: { linkedin: 'linkedin.com/in/example' }, education: ['LL.B.'], admissions: ['Nigerian Bar'], practiceInterests: ['Business Law'] }).success, true);
assert.equal(contentSchema.safeParse({
  title: 'Insight with assets',
  image: { url: 'https://res.cloudinary.com/example/image/upload/cover.jpg', mediaId: 'cover-id', alt: 'Cover' },
  thumbnail: { url: 'https://res.cloudinary.com/example/image/upload/thumb.jpg', mediaId: 'thumb-id', alt: 'Thumbnail' },
}).success, true);
assert.equal(contentSchema.safeParse({
  fullName: 'Seeded Team Member',
  photo: { url: '/assets/faith-zekeri.png' },
}).success, true);
assert.deepEqual(Object.keys(contentModels).sort(), ['insights', 'practice-areas', 'results', 'statistics', 'team', 'testimonials']);
assert.deepEqual(PracticeArea.schema.requiredPaths().sort(), ['fullDescription', 'shortDescription', 'slug', 'title'].sort());
assert.deepEqual(TeamMember.schema.requiredPaths().sort(), ['fullBio', 'fullName', 'role', 'slug'].sort());
assert.ok(TeamMember.schema.path('photo'));
assert.ok(TeamMember.schema.path('shortBio'));
assert.ok(TeamMember.schema.path('contact'));
assert.ok(TeamMember.schema.path('education'));
assert.ok(TeamMember.schema.path('admissions'));
assert.ok(TeamMember.schema.path('practiceInterests'));
assert.ok(TeamMember.schema.path('displayOrder'));
assert.ok(Result.schema.path('matterDescription'));
assert.ok(Result.schema.path('jurisdiction'));
assert.ok(Result.schema.path('displayOrder'));
assert.equal(contentSchema.safeParse({ title: 'Result', headlineFigure: '1', category: 'Category', shortDescription: 'Summary', matterDescription: 'Matter detail.' }).success, true);
assert.equal(contentSchema.safeParse({ clientDisplayName: 'Client', position: 'Matter', testimonial: 'Approved words.', identityMode: 'named', consentConfirmed: true, isFeatured: true }).success, true);
assert.ok(Testimonial.schema.path('identityMode'));
assert.ok(Testimonial.schema.path('consentConfirmed'));
assert.ok(Testimonial.schema.path('isFeatured'));
assert.ok(Testimonial.schema.path('displayOrder'));
assert.equal(contentSchema.safeParse({ value: '14', label: 'Matters', supportingText: 'Verified context.', verifiedAt: new Date().toISOString(), isFeatured: true }).success, true);
assert.ok(FirmStatistic.schema.path('supportingText'));
assert.ok(FirmStatistic.schema.path('verifiedAt'));
assert.ok(FirmStatistic.schema.path('isFeatured'));
assert.ok(FirmStatistic.schema.path('displayOrder'));
assert.ok(SearchQuery.schema.path('searchId'));
assert.ok(SearchQuery.schema.path('clickCount'));
assert.ok(ConsentRecord.schema.path('anonymousId'));
assert.ok(ConsentRecord.schema.path('analytics'));
assert.ok(ConsentRecord.schema.path('policyVersion'));
assert.deepEqual(Result.schema.requiredPaths().sort(), ['category', 'headlineFigure', 'shortDescription', 'slug', 'title'].sort());
assert.deepEqual(Insight.schema.requiredPaths().sort(), ['content', 'excerpt', 'slug', 'title'].sort());
assert.deepEqual(Testimonial.schema.requiredPaths().sort(), ['clientDisplayName', 'position', 'testimonial'].sort());
assert.deepEqual(FirmStatistic.schema.requiredPaths().sort(), ['label', 'value'].sort());

console.log('Node API smoke tests passed: 20 contract checks.');
