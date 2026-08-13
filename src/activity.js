import { ActivityLog } from './models.js';

const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  const copy = Array.isArray(value) ? value.map(redact) : { ...value };
  for (const key of ['password', 'password_confirmation', 'remember_token', 'token', 'secret']) delete copy[key];
  return copy;
};

export const logActivity = async ({ adminId, action, entityType, entityId, description, oldValues = {}, newValues = {}, req }) => (
  ActivityLog.create({
    adminId: adminId ? String(adminId) : null,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    description,
    oldValues: redact(oldValues),
    newValues: redact(newValues),
    ipAddress: req?.ip,
  })
);
