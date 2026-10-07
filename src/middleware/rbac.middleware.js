/**
 * Role-Based Access Control (RBAC) & Fine-Grained Permissions Middleware
 */

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    '*',
    'users:read',
    'users:write',
    'users:delete',
    'roles:write',
    'sessions:revoke',
    'audit:read',
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    'orders:read',
    'orders:write',
  ],
  moderator: [
    'users:read',
    'products:read',
    'products:create',
    'products:update',
    'orders:read',
  ],
  user: [
    'users:read',
    'products:read',
    'orders:read',
    'orders:create',
  ],
};

/**
 * Retrieve deduplicated list of permissions for a given set of roles
 * @param {Array<string>} roles
 * @returns {Array<string>}
 */
export const getPermissionsForRoles = (roles = ['user']) => {
  const permSet = new Set();
  for (const role of roles) {
    const list = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
    for (const p of list) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
};

/**
 * Require specific role
 * @param {string} requiredRole
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

/**
 * Require specific fine-grained permission
 * @param {string} requiredPermission
 */
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userPerms = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : getPermissionsForRoles(Array.isArray(req.user.roles) ? req.user.roles : [req.user.role || 'user']);

    if (!userPerms.includes('*') && !userPerms.includes(requiredPermission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires '${requiredPermission}' permission.`,
      });
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');

export default {
  DEFAULT_ROLE_PERMISSIONS,
  getPermissionsForRoles,
  requireRole,
  requirePermission,
  requireAdmin,
};
