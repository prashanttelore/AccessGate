import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import redisClient from '../config/redis.js';
import UserModel from '../models/user.model.js';
import LoginAttemptModel from '../models/loginAttempt.model.js';

import RefreshTokenModel from '../models/refreshToken.model.js';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export const AuthService = {
  /**
   * Hash a plain password
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Compare plain password with hash
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  /**
   * Generate access and refresh JWTs
   * @param {Object} user
   * @returns {Object} { accessToken, refreshToken, expiresIn }
   */
  generateTokens(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, env.jwtAccessSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(payload, env.jwtRefreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  },

  /**
   * Register a new user
   */
  async register({ email, password, name }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      const error = new Error('Email is already registered');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await this.hashPassword(password);
    const user = await UserModel.create({ email, passwordHash, name });
    const tokens = this.generateTokens(user);

    return { user, tokens };
  },

  /**
   * Authenticate user with credentials
   */
  async login({ email, password, ipAddress = null, userAgent = null }) {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      try {
        await LoginAttemptModel.create({ email, successful: false, ipAddress, userAgent });
      } catch {}
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await this.comparePassword(password, user.password_hash);
    if (!isMatch) {
      try {
        await LoginAttemptModel.create({ userId: user.id, email, successful: false, ipAddress, userAgent });
      } catch {}
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    try {
      await LoginAttemptModel.create({ userId: user.id, email, successful: true, ipAddress, userAgent });
    } catch {}

    const tokens = this.generateTokens(user);
    const { password_hash, ...safeUser } = user;

    return { user: safeUser, tokens };
  },

  /**
   * Refresh tokens using a valid refresh token (Token rotation)
   * @param {Object} data
   * @param {string} data.refreshToken
   * @returns {Promise<Object>}
   */
  async refresh({ refreshToken }) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 400;
      throw error;
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const isRevoked = await this.isTokenRevoked(refreshToken);
    if (isRevoked) {
      const error = new Error('Refresh token has been revoked');
      error.statusCode = 401;
      throw error;
    }

    const user = await UserModel.findById(payload.sub);
    if (!user || !user.is_active) {
      const error = new Error('User not found or deactivated');
      error.statusCode = 401;
      throw error;
    }

    // Revoke old refresh token for rotation
    await this.revokeToken(refreshToken, 7 * 24 * 3600);

    const tokens = this.generateTokens(user);
    const { password_hash, ...safeUser } = user;
    return { user: safeUser, tokens };
  },

  /**
   * Revoke all active sessions for a user
   * @param {string} userId
   * @param {string} [currentAccessToken]
   * @returns {Promise<boolean>}
   */
  async logoutAll(userId, currentAccessToken = null) {
    await RefreshTokenModel.revokeAllForUser(userId);
    if (currentAccessToken) {
      await this.revokeToken(currentAccessToken, 15 * 60);
    }
    return true;
  },

  /**
   * Store revoked token in Redis (Token Blacklist)
   * @param {string} token
   * @param {number} ttlInSeconds
   */
  async revokeToken(token, ttlInSeconds = 3600) {
    try {
      await redisClient.set(`bl:${token}`, 'revoked', 'EX', ttlInSeconds);
    } catch (err) {
      console.warn('[AuthService] Redis revoke token failed:', err.message);
    }
  },

  /**
   * Check if token is in blacklist
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async isTokenRevoked(token) {
    try {
      const result = await redisClient.get(`bl:${token}`);
      return Boolean(result);
    } catch (err) {
      console.warn('[AuthService] Redis check token failed:', err.message);
      return false;
    }
  },
};

export default AuthService;
