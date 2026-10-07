import { query } from '../config/db.js';

/**
 * Login Attempt Model
 * Tracks successful and failed authentication attempts for auditing
 */
export const LoginAttemptModel = {
  /**
   * Record a login attempt
   * @param {Object} data
   * @param {string|null} [data.userId]
   * @param {string} data.email
   * @param {string|null} [data.ipAddress]
   * @param {string|null} [data.userAgent]
   * @param {boolean} [data.successful]
   * @returns {Promise<Object>}
   */
  async create({ userId = null, email, ipAddress = null, userAgent = null, successful = false }) {
    const sql = `
      INSERT INTO login_attempts (user_id, email, ip_address, user_agent, successful)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, email, ip_address, user_agent, successful, created_at
    `;
    const res = await query(sql, [
      userId,
      email.toLowerCase().trim(),
      ipAddress,
      userAgent,
      successful,
    ]);
    return res.rows[0];
  },

  /**
   * Get login attempts history by user ID or email
   * @param {string} userId
   * @param {string} email
   * @param {number} [limit=50]
   * @returns {Promise<Array>}
   */
  async getByUserIdOrEmail(userId, email, limit = 50) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const sql = `
      SELECT id, user_id, email, ip_address, user_agent, successful, created_at
      FROM login_attempts
      WHERE user_id = $1 OR email = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const res = await query(sql, [userId, normalizedEmail, limit]);
    return res.rows;
  },

  /**
   * Clear all login attempts (for testing)
   */
  async clearAll() {
    await query('DELETE FROM login_attempts');
  },
};

export default LoginAttemptModel;
