import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import redisClient from '../config/redis.js';
import UserModel from '../models/user.model.js';

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
  async login({ email, password }) {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await this.comparePassword(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const tokens = this.generateTokens(user);
    const { password_hash, ...safeUser } = user;

    return { user: safeUser, tokens };
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
