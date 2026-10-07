import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AuthService from '../services/auth.service.js';
import { getPermissionsForRoles } from './rbac.middleware.js';

/**
 * Authentication Middleware
 * Validates the JWT Bearer token in the Authorization header and verifies against Redis blacklist
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is missing or invalid',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify against Redis blacklist
    const isRevoked = await AuthService.isTokenRevoked(token);
    if (isRevoked) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has been revoked',
      });
    }

    // 2. Cryptographic signature and expiration verification
    const decoded = jwt.verify(token, env.jwtAccessSecret);
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles
      : [decoded.role || 'user'];
    const permissions = decoded.permissions || getPermissionsForRoles(roles);

    req.user = {
      ...decoded,
      roles,
      permissions,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired or is invalid',
    });
  }
};

export default authenticate;
