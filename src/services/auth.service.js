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

    // Handle OAuth-only accounts
    if (!user.password_hash) {
      try {
        await LoginAttemptModel.create({ userId: user.id, email, successful: false, ipAddress, userAgent });
      } catch {}
      const error = new Error('This account was created with Google Sign-In. Please sign in with Google.');
      error.statusCode = 400;
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
   * Exchange Google OAuth authorization code for Google profile
   * Supports mock/demo mode for local development/testing
   */
  async exchangeGoogleCode(code) {
    if (code === 'mock_google_code' || code?.startsWith('mock_')) {
      return {
        googleId: 'google-mock-id-12345',
        email: 'google.mock@example.com',
        name: 'Google Demo User',
      };
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleCallbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      const error = new Error(`Failed to exchange Google OAuth code: ${errBody}`);
      error.statusCode = 400;
      throw error;
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      const error = new Error('Failed to fetch Google user profile');
      error.statusCode = 400;
      throw error;
    }

    const profile = await profileResponse.json();
    return {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.given_name || '',
    };
  },

  /**
   * Authenticate or register a user via Google OAuth profile
   */
  async handleGoogleAuth({ profile, ipAddress = null, userAgent = null }) {
    const { googleId, email, name } = profile;
    if (!email || !googleId) {
      const error = new Error('Incomplete Google profile information');
      error.statusCode = 400;
      throw error;
    }

    // 1. Check if user already exists with this google_id
    let user = await UserModel.findByGoogleId(googleId);

    // 2. If not found by google_id, check if existing user with matching email
    if (!user) {
      user = await UserModel.findByEmail(email);
      if (user) {
        // Link google_id to existing account
        user = await UserModel.linkGoogleId(user.id, googleId);
      } else {
        // 3. Create new OAuth user with no password_hash (safe under race conditions)
        try {
          user = await UserModel.create({
            email,
            name: name || '',
            googleId,
            role: 'user',
            passwordHash: null,
          });
        } catch (err) {
          if (
            err.code === '23505' ||
            err.message?.includes('duplicate key') ||
            err.message?.includes('unique constraint') ||
            err.message?.includes('violates unique constraint')
          ) {
            user = (await UserModel.findByGoogleId(googleId)) || (await UserModel.findByEmail(email));
          } else {
            throw err;
          }
        }
      }
    }

    if (!user.is_active) {
      const error = new Error('User account is deactivated');
      error.statusCode = 403;
      throw error;
    }

    // Record login attempt
    try {
      await LoginAttemptModel.create({
        userId: user.id,
        email: user.email,
        successful: true,
        ipAddress,
        userAgent,
      });
    } catch {}

    // Issue AccessGate's OWN access & refresh tokens
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
