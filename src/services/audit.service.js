import AuditLogModel from '../models/auditLog.model.js';

/**
 * Audit Service
 * Central service for creating and querying audit log records
 */
export const AuditService = {
  /**
   * Log an administrative or security action
   * @param {Object} params
   * @param {string} [params.actorUserId]
   * @param {string} params.action
   * @param {string} [params.targetUserId]
   * @param {Object} [params.metadata]
   * @returns {Promise<Object>}
   */
  async log({ actorUserId = null, action, targetUserId = null, metadata = {} }) {
    try {
      return await AuditLogModel.create({
        actorUserId,
        action,
        targetUserId,
        metadata,
      });
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err.message);
      return null;
    }
  },

  /**
   * Fetch paginated and filtered audit logs
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {string} [options.action]
   * @param {string} [options.startDate]
   * @param {string} [options.endDate]
   * @returns {Promise<{ logs: Array, auditLogs: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getLogs({ page = 1, limit = 10, action = null, startDate = null, endDate = null }) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, parseInt(limit || '10', 10));

    const [logs, total] = await Promise.all([
      AuditLogModel.list({
        page: pageNum,
        limit: limitNum,
        action,
        startDate,
        endDate,
      }),
      AuditLogModel.count({
        action,
        startDate,
        endDate,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    return {
      logs,
      auditLogs: logs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  },
};

export default AuditService;
