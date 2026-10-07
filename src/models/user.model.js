import { query } from '../config/db.js';

/**
 * User Model for AccessGate Auth Service
 */
export const UserModel = {
  /**
   * Find a user by email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const res = await query(
      `SELECT id, email, password_hash, name, role, is_active, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  },

  /**
   * Find a user by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const res = await query(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  /**
   * Create a new user
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async create({ id, email, passwordHash, name = '', role = 'user' }) {
    if (id) {
      const res = await query(
        `INSERT INTO users (id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role, is_active, created_at, updated_at`,
        [id, email.toLowerCase().trim(), passwordHash, name, role]
      );
      return res.rows[0];
    }
    const res = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [email.toLowerCase().trim(), passwordHash, name, role]
    );
    return res.rows[0];
  },

  /**
   * List users with pagination and optional email filter
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {string} [options.email]
   * @returns {Promise<Array>}
   */
  async list({ page = 1, limit = 10, email = null }) {
    const offset = (Math.max(1, page) - 1) * limit;
    const params = [];
    let whereClause = '';

    if (email && email.trim()) {
      params.push(`%${email.trim().toLowerCase()}%`);
      whereClause = `WHERE LOWER(email) LIKE $${params.length}`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT id, email, name, role, is_active, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const res = await query(sql, params);
    return res.rows.map((u) => ({
      ...u,
      roles: [u.role || 'user'],
    }));
  },

  /**
   * Count users matching optional email filter
   * @param {Object} options
   * @param {string} [options.email]
   * @returns {Promise<number>}
   */
  async count({ email = null }) {
    const params = [];
    let whereClause = '';

    if (email && email.trim()) {
      params.push(`%${email.trim().toLowerCase()}%`);
      whereClause = `WHERE LOWER(email) LIKE $${params.length}`;
    }

    const sql = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
    const res = await query(sql, params);
    return parseInt(res.rows[0]?.total || '0', 10);
  },

  /**
   * Update role for a user
   * @param {string} id
   * @param {string} role
   * @returns {Promise<Object|null>}
   */
  async updateRole(id, role) {
    const res = await query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [role, id]
    );
    if (!res.rows[0]) return null;
    return {
      ...res.rows[0],
      roles: [res.rows[0].role || 'user'],
    };
  },

  /**
   * Clear all users (for testing)
   */
  async clearAll() {
    await query('DELETE FROM users');
  },
};

export default UserModel;
