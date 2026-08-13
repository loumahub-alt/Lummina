import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from './db.js';
import { AdminUser, PageSeo, SiteSetting, allModels, contentModels } from './models.js';
import { practiceAreas, results, insights, testimonials, statistics, seo, settings } from '../seed-data/content.js';

const seedCollection = async (Model, items, uniqueField, additions = {}) => {
  for (const [index, item] of items.entries()) {
    const existing = await Model.findOne({ [uniqueField]: item[uniqueField] }).select('icon').lean();
    const preserved = existing?.icon ? { icon: existing.icon } : {};
    await Model.findOneAndUpdate({ [uniqueField]: item[uniqueField] }, { $set: { ...item, ...additions, ...preserved, displayOrder: item.displayOrder ?? index } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
};

const seed = async () => {
  const now = new Date();
  await seedCollection(contentModels['practice-areas'][0], practiceAreas, 'slug', { status: 'published', publishedAt: now });
  await seedCollection(contentModels.results[0], results, 'slug', { status: 'published', publishedAt: now });
  await seedCollection(contentModels.insights[0], insights, 'slug', { status: 'published', publishedAt: now });
  for (const [index, item] of testimonials.entries()) await contentModels.testimonials[0].findOneAndUpdate({ clientDisplayName: item.clientDisplayName }, { $set: { ...item, status: 'published', isFeatured: index === 0, displayOrder: index, consentConfirmed: true } }, { upsert: true, new: true });
  for (const [index, item] of statistics.entries()) await contentModels.statistics[0].findOneAndUpdate({ value: item.value, label: item.label }, { $set: { ...item, status: 'published', displayOrder: index, isFeatured: true, verifiedAt: now } }, { upsert: true, new: true });
  for (const item of seo) await PageSeo.findOneAndUpdate({ pageKey: item.pageKey }, { $set: { ...item, pageKey: item.pageKey, indexable: true } }, { upsert: true, new: true });
  for (const [key, value] of Object.entries(settings)) await SiteSetting.findOneAndUpdate({ key }, { $set: { key, value } }, { upsert: true, new: true });

  if (process.env.LUMMINA_ADMIN_EMAIL && process.env.LUMMINA_ADMIN_PASSWORD) {
    const email = process.env.LUMMINA_ADMIN_EMAIL.trim().toLowerCase();
    if (process.env.LUMMINA_ADMIN_PASSWORD.length < 8) throw new Error('LUMMINA_ADMIN_PASSWORD must be at least 8 characters.');
    await AdminUser.findOneAndUpdate(
      { email },
      { $set: { firstName: process.env.LUMMINA_ADMIN_FIRST_NAME ?? 'Faith', lastName: process.env.LUMMINA_ADMIN_LAST_NAME ?? 'Zekeri', password: await bcrypt.hash(process.env.LUMMINA_ADMIN_PASSWORD, 12), role: 'super_admin', permissions: ['*'], isActive: true, twoFactorEnabled: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log('Lummina MongoDB content and settings seeded.');
};

const main = async () => {
  const command = process.argv[2] ?? 'setup';
  await connectDatabase();
  for (const Model of allModels) await Model.syncIndexes();
  if (command === 'setup' || command === 'seed') await seed();
  else throw new Error('Unknown command: ' + command);
  await disconnectDatabase();
};

main().catch(async (error) => {
  console.error(error.message);
  await disconnectDatabase();
  process.exitCode = 1;
});
