import { query } from '../config/db.js';

/**
 * Refresh Token Model
 * Manages opaque refresh tokens and user sessions
 */
export const RefreshTokenModel = {
  /**
   * Create a new refresh token record
   * @param {Object} data
   * @param {string} data.userId
   * @param {string} data.tokenHash
   * @param {string} [data.deviceInfo]
   * @param {Date|string} data.expiresAt
   * @returns {Promise<Object>}
   */
  async create({ userId, tokenHash, deviceInfo = '', expiresAt }) {
    const res = await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, device_info, created_at, expires_at, revoked_at`,
      [userId, tokenHash, deviceInfo, expiresAt]
    );
    return res.rows[0];
  },

  /**
   * Revoke all active sessions (refresh tokens) for a given user
   * @param {string} userId
   * @returns {Promise<Array>} List of revoked token IDs
   */
  async revokeAllForUser(userId) {
    const res = await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL
       RETURNING id, user_id, revoked_at`,
      [userId]
    );
    return res.rows;
  },

  /**
   * Find active tokens for a user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findActiveByUserId(userId) {
    const res = await query(
      `SELECT id, user_id, token_hash, device_info, created_at, expires_at, revoked_at
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return res.rows;
  },

  /**
   * Clear all refresh tokens (for testing)
   */
  async clearAll() {
    await query('DELETE FROM refresh_tokens');
  },
};

export default RefreshTokenModel;
