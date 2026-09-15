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
  async create({ email, passwordHash, name = '', role = 'user' }) {
    const res = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [email.toLowerCase().trim(), passwordHash, name, role]
    );
    return res.rows[0];
  },
};

export default UserModel;
