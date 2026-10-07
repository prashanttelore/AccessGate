import jwt from 'jsonwebtoken';

/**
 * AccessGate Node.js Client
 */
export class AccessGate {
  /**
   * @param {Object} options
   * @param {string} [options.issuerUrl] - Base URL of AccessGate (e.g. 'http://localhost:3000')
   * @param {string} [options.jwtSecret] - Secret or public key for local JWT verification
   * @param {string} [options.introspectEndpoint] - Custom introspection endpoint
   * @param {number} [options.cacheTtlMs=30000] - In-memory cache duration for remote introspection
   * @param {number} [options.timeoutMs=5000] - Request timeout for network requests
   */
  constructor(options = {}) {
    this.issuerUrl = (options.issuerUrl || process.env.ACCESSGATE_URL || '').replace(/\/+$/, '');
    this.jwtSecret = options.jwtSecret || process.env.ACCESSGATE_JWT_SECRET || null;
    this.introspectEndpoint =
      options.introspectEndpoint ||
      (this.issuerUrl ? `${this.issuerUrl}/token/introspect` : null);
    this.cacheTtlMs = typeof options.cacheTtlMs === 'number' ? options.cacheTtlMs : 30000;
    this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 5000;

    // Cache: Map<token, { data, expiresAt }>
    this._cache = new Map();

    if (!this.issuerUrl && !this.jwtSecret) {
      console.warn(
        '[AccessGate SDK] Warning: Neither issuerUrl nor jwtSecret was provided. SDK will require configuration before verifying tokens.'
      );
    }
  }

  /**
   * Introspect a token against AccessGate service or verify locally
   * @param {string} token
   * @returns {Promise<{active: boolean, user?: object, roles?: string[], permissions?: string[], error?: string}>}
   */
  async introspect(token) {
    if (!token) {
      return { active: false, error: 'Token is required' };
    }

    // 1. Check in-memory TTL cache
    const cached = this._cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 2. Perform verification (local or remote)
    let result;
    if (this.introspectEndpoint) {
      result = await this._introspectRemote(token);
    } else if (this.jwtSecret) {
      result = this.verifyLocal(token);
    } else {
      throw new Error(
        'AccessGate SDK misconfigured: requires either issuerUrl for remote introspection or jwtSecret for local verification.'
      );
    }

    // 3. Cache valid active results
    if (result.active && this.cacheTtlMs > 0) {
      this._cache.set(token, {
        data: result,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      // Cleanup expired cache entries periodically
      if (this._cache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of this._cache.entries()) {
          if (v.expiresAt <= now) this._cache.delete(k);
        }
      }
    }

    return result;
  }

  /**
   * Verify token locally using shared secret or public key
   * @param {string} token
   * @returns {{active: boolean, user?: object, roles?: string[], permissions?: string[], error?: string}}
   */
  verifyLocal(token) {
    if (!this.jwtSecret) {
      throw new Error('AccessGate SDK: jwtSecret is required for local token verification');
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const roles = Array.isArray(decoded.roles) ? decoded.roles : [decoded.role || 'user'];
      const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];

      const user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || '',
        role: decoded.role || roles[0],
        roles,
        permissions,
      };

      return {
        active: true,
        sub: decoded.sub,
        user,
        roles,
        permissions,
        exp: decoded.exp,
        iat: decoded.iat,
      };
    } catch (err) {
      return {
        active: false,
        error: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token signature',
      };
    }
  }

  /**
   * Call AccessGate introspection endpoint over HTTP
   * @private
   */
  async _introspectRemote(token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.introspectEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          active: false,
          error: `Introspection service returned HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        return { active: false, error: 'Introspection request timed out' };
      }
      return { active: false, error: `Introspection network error: ${err.message}` };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Express Middleware: Require valid AccessGate authentication token
   * Validates JWT locally or via remote introspection, then attaches `req.user`
   */
  requireAuth() {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token is missing or malformed',
        });
      }

      const token = authHeader.split(' ')[1];

      try {
        const result = await this.introspect(token);
        if (!result || !result.active) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: result?.error || 'Authentication token is invalid or expired',
          });
        }

        // Attach enriched user and token to request object
        req.user = result.user || {
          id: result.sub,
          roles: result.roles || [],
          permissions: result.permissions || [],
        };
        req.token = token;
        next();
      } catch (err) {
        return res.status(500).json({
          error: 'InternalServerError',
          message: `Authentication verification failed: ${err.message}`,
        });
      }
    };
  }

  /**
   * Express Middleware: Require user to possess a specific role
   * @param {string} roleName
   */
  requireRole(roleName) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required before role check',
        });
      }

      const roles = Array.isArray(req.user.roles)
        ? req.user.roles
        : [req.user.role || 'user'];

      if (!roles.includes(roleName)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. Requires '${roleName}' role.`,
        });
      }

      next();
    };
  }

  /**
   * Express Middleware: Require user to possess a specific permission
   * @param {string} permissionName
   */
  requirePermission(permissionName) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required before permission check',
        });
      }

      const permissions = Array.isArray(req.user.permissions)
        ? req.user.permissions
        : [];

      // Wildcard '*' permission grants all privileges
      if (!permissions.includes('*') && !permissions.includes(permissionName)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. Requires '${permissionName}' permission.`,
        });
      }

      next();
    };
  }
}

export default AccessGate;
