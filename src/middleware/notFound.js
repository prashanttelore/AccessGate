/**
 * 404 Not Found Middleware
 */
export const notFound = (req, res, next) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

export default notFound;
