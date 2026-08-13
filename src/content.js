import { ContentRevision, contentModels } from './models.js';
import { logActivity } from './activity.js';

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const contentSlugSource = (resource, data, model) => {
  if (data.slug !== undefined) return data.slug;
  if (model.slug) return model.slug;
  if (resource === 'team') return data.fullName;
  return data.title ?? data.name ?? data.fullName;
};

const requiredFields = {
  'practice-areas': ['title', 'shortDescription', 'fullDescription'],
  team: ['fullName', 'role', 'fullBio'],
  results: ['title', 'headlineFigure', 'category', 'shortDescription'],
  insights: ['title', 'excerpt', 'content'],
  testimonials: ['clientDisplayName', 'position', 'testimonial'],
  statistics: ['value', 'label'],
};

const normalizePracticeAreaServices = (value) => {
  if (!Array.isArray(value)) return value;
  return value
    .map((service, index) => {
      if (typeof service === 'string') {
        const name = service.trim();
        return name ? { name, displayOrder: index } : null;
      }
      if (service && typeof service === 'object' && typeof service.name === 'string') {
        const name = service.name.trim();
        return name
          ? { ...service, name, displayOrder: Number.isFinite(Number(service.displayOrder)) ? Number(service.displayOrder) : index }
          : null;
      }
      return null;
    })
    .filter(Boolean);
};

const normalizeContentAsset = (value) => {
  if (typeof value === 'string' && value.trim()) {
    return { url: value.trim(), mediaId: '', alt: '' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const asset = value;
  const storage = asset.storage && typeof asset.storage === 'object' ? asset.storage : {};
  const url = asset.url ?? asset.secure_url ?? asset.secureUrl ?? storage.url ?? '';
  if (!String(url).trim()) return value;

  return {
    ...asset,
    url: String(url).trim(),
    mediaId: String(asset.mediaId ?? asset.id ?? '').trim(),
    alt: String(asset.alt ?? asset.altText ?? '').trim(),
  };
};

const normalizeTeamList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
};

export const getContentResource = (resource) => {
  const result = contentModels[resource];
  if (!result) {
    const error = new Error('Unknown content resource.');
    error.status = 404;
    throw error;
  }
  return result;
};

export const listContent = async (resource, { status, search, page = 1, perPage = 20, publishedOnly = false }) => {
  const [Model] = getContentResource(resource);
  const filter = {};
  if (publishedOnly) filter.status = 'published';
  else if (status && status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ];
  }

  const safePerPage = Math.min(Math.max(Number(perPage) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const query = Model.find(filter).sort({ displayOrder: 1, publishedAt: -1, createdAt: -1 });
  const [items, total] = await Promise.all([
    query.skip((safePage - 1) * safePerPage).limit(safePerPage).exec(),
    Model.countDocuments(filter),
  ]);
  return {
    items,
    meta: { currentPage: safePage, lastPage: Math.max(Math.ceil(total / safePerPage), 1), perPage: safePerPage, total },
  };
};

export const publicContent = async (resource, slug) => {
  const [Model] = getContentResource(resource);
  const filter = { status: 'published' };
  if (slug) return Model.findOne({ ...filter, slug }).orFail();
  if (resource === 'testimonials') return Model.find(filter).sort({ isFeatured: -1, displayOrder: 1, publishedAt: -1, createdAt: -1 });
  return Model.find(filter).sort({ displayOrder: 1, publishedAt: -1, createdAt: -1 });
};

export const saveContent = async (resource, data, adminId, id, req) => {
  const [Model, entityType] = getContentResource(resource);
  const model = id ? await Model.findById(id).orFail() : new Model();
  const old = model.toObject();
  const next = { ...data };
  delete next.id;
  delete next._id;
  delete next.createdAt;
  delete next.updatedAt;
  if (resource === 'practice-areas' && next.services !== undefined) {
    next.services = normalizePracticeAreaServices(next.services);
  }
  if (resource === 'insights') {
    if (next.image !== undefined) next.image = normalizeContentAsset(next.image);
    if (next.thumbnail !== undefined) next.thumbnail = normalizeContentAsset(next.thumbnail);
  }
  if (resource === 'team' && next.photo !== undefined) {
    next.photo = normalizeContentAsset(next.photo);
  }
  if (resource === 'team') {
    next.practiceInterests = normalizeTeamList(next.practiceInterests);
    next.education = normalizeTeamList(next.education);
    next.admissions = normalizeTeamList(next.admissions);
  }
  next.status ??= model.status ?? 'draft';
  const missing = (requiredFields[resource] ?? []).filter((field) => !String(next[field] ?? '').trim());
  if (missing.length) {
    const error = new Error('Required content fields are missing: ' + missing.join(', ') + '.');
    error.status = 422;
    throw error;
  }
  const rawSlug = contentSlugSource(resource, next, model);
  const normalizedSlug = slugify(rawSlug);
  if (rawSlug !== undefined || resource === 'team') {
    if (!normalizedSlug) {
      const error = new Error(resource === 'team' ? 'A team profile needs a valid name before it can be saved.' : 'This content needs a valid title before it can be saved.');
      error.status = 422;
      throw error;
    }
    next.slug = normalizedSlug;
  }
  const duplicate = next.slug
    ? await Model.exists({ slug: next.slug, ...(id ? { _id: { $ne: model._id } } : {}) })
    : null;
  if (duplicate) {
    const error = new Error('Another ' + entityType.replace('_', ' ') + ' already uses this name.');
    error.status = 422;
    throw error;
  }
  if (next.status === 'published' && resource === 'testimonials' && next.consentConfirmed !== true && model.consentConfirmed !== true) {
    const error = new Error('This content does not meet the requirements for publication.');
    error.status = 422;
    throw error;
  }
  if (next.status === 'published' && resource === 'statistics' && !next.verifiedAt && !model.verifiedAt) {
    const error = new Error('A verification date is required before publishing a firm statistic.');
    error.status = 422;
    throw error;
  }
  if (next.status === 'published' && !model.publishedAt) next.publishedAt = new Date();
  next.updatedBy = String(adminId);
  if (model.isNew) next.createdBy = String(adminId);
  Object.assign(model, next);
  await model.save();

  const version = (await ContentRevision.findOne({ entityType, entityId: String(model._id) }).sort({ version: -1 }).lean())?.version ?? 0;
  await ContentRevision.create({ entityType, entityId: String(model._id), version: version + 1, snapshot: model.toObject(), createdBy: String(adminId) });
  await logActivity({ adminId, action: id ? 'updated' : 'created', entityType, entityId: model._id, description: (id ? 'Updated ' : 'Created ') + entityType + '.', oldValues: old, newValues: model.toObject(), req });
  return model;
};

export const archiveContent = async (resource, id, adminId, req) => {
  const [Model, entityType] = getContentResource(resource);
  const model = await Model.findById(id).orFail();
  const old = model.toObject();
  model.status = 'archived';
  model.updatedBy = String(adminId);
  await model.save();
  await logActivity({ adminId, action: 'archived', entityType, entityId: id, description: 'Archived ' + entityType + '.', oldValues: old, newValues: model.toObject(), req });
  return model;
};

export const deleteContent = async (resource, id, adminId, req) => {
  const [Model, entityType] = getContentResource(resource);
  const model = await Model.findById(id).orFail();
  const old = model.toObject();
  await ContentRevision.deleteMany({ entityType, entityId: String(model._id) });
  await model.deleteOne();
  await logActivity({
    adminId,
    action: 'deleted',
    entityType,
    entityId: id,
    description: 'Permanently deleted ' + entityType + '.',
    oldValues: old,
    req,
  });
  return { deleted: true, id: String(id) };
};
