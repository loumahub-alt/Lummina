export const dataResponse = (res, data, status = 200, meta = {}) => {
  const payload = { data };
  if (Object.keys(meta).length) payload.meta = meta;
  return res.status(status).json(payload);
};

export const errorResponse = (res, message, status = 400, errors) => {
  const payload = { message };
  if (errors && Object.keys(errors).length) payload.errors = errors;
  return res.status(status).json(payload);
};

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
