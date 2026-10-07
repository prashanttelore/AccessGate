import { query } from '../config/db.js';

/**
 * Audit Log Model
 * Tracks all administrative actions and security events
 */
export const AuditLogModel = {
  /**
   * Create a new audit log entry
   * @param {Object} data
   * @param {string|null} [data.actorUserId]
   * @param {string} data.action
   * @param {string|null} [data.targetUserId]
   * @param {Object} [data.metadata]
   * @returns {Promise<Object>}
   */
  async create({ actorUserId = null, action, targetUserId = null, metadata = {} }) {
    const metaJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    const sql = `
      INSERT INTO audit_logs (actor_user_id, action, target_user_id, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id, actor_user_id, action, target_user_id, metadata, created_at
    `;
    const res = await query(sql, [actorUserId, action, targetUserId, metaJson]);
    return res.rows[0];
  },

  /**
   * List paginated audit logs with optional filtering by action type and date range
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {string} [options.action]
   * @param {string|Date} [options.startDate]
   * @param {string|Date} [options.endDate]
   * @returns {Promise<Array>}
   */
  async list({ page = 1, limit = 10, action = null, startDate = null, endDate = null }) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const params = [];

    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    if (startDate) {
      params.push(new Date(startDate).toISOString());
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(new Date(endDate).toISOString());
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT id, actor_user_id, action, target_user_id, metadata, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const res = await query(sql, params);
    return res.rows.map((row) => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));
  },

  /**
   * Count total audit logs matching filters
   * @param {Object} options
   * @param {string} [options.action]
   * @param {string|Date} [options.startDate]
   * @param {string|Date} [options.endDate]
   * @returns {Promise<number>}
   */
  async count({ action = null, startDate = null, endDate = null }) {
    const conditions = [];
    const params = [];

    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    if (startDate) {
      params.push(new Date(startDate).toISOString());
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(new Date(endDate).toISOString());
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`;
    const res = await query(sql, params);
    return parseInt(res.rows[0]?.total || '0', 10);
  },

  /**
   * Clear all audit logs (for testing)
   */
  async clearAll() {
    await query('DELETE FROM audit_logs');
  },
};

export default AuditLogModel;
