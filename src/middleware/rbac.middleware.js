/**
 * Role-Based Access Control (RBAC) Middleware
 * Verifies authenticated user has required role
 */
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : [req.user.role || 'user'];

    if (!userRoles.includes(requiredRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires '${requiredRole}' role.`,
      });
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');

export default {
  requireRole,
  requireAdmin,
};
