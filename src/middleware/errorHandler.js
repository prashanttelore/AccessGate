import env from '../config/env.js';

/**
 * Global Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (!env.isTest && statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
