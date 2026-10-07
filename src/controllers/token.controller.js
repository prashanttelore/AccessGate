import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AuthService from '../services/auth.service.js';
import UserModel from '../models/user.model.js';
import { getPermissionsForRoles } from '../middleware/rbac.middleware.js';

export const TokenController = {
  /**
   * POST /token/introspect
   * RFC 7662 compliant token introspection endpoint
   */
  async introspect(req, res, next) {
    try {
      let token = req.body?.token;

      // Also support reading from Authorization header if not provided in body
      if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        return res.status(200).json({
          active: false,
          error: 'Token parameter is missing',
        });
      }

      // 1. Check if token is in Redis blacklist
      const isRevoked = await AuthService.isTokenRevoked(token);
      if (isRevoked) {
        return res.status(200).json({
          active: false,
          error: 'Token has been revoked',
        });
      }

      // 2. Cryptographically verify token signature and expiry
      let decoded;
      try {
        decoded = jwt.verify(token, env.jwtAccessSecret);
      } catch (err) {
        return res.status(200).json({
          active: false,
          error: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token signature',
        });
      }

      // 3. Query user from DB for active status and up-to-date roles
      const user = await UserModel.findById(decoded.sub);
      if (!user || user.is_active === false) {
        return res.status(200).json({
          active: false,
          error: 'User account not found or deactivated',
        });
      }

      const roles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
      const permissions = getPermissionsForRoles(roles);

      return res.status(200).json({
        active: true,
        sub: user.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roles,
          permissions,
          is_active: user.is_active,
        },
        roles,
        permissions,
        exp: decoded.exp,
        iat: decoded.iat,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default TokenController;
