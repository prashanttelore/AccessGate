import { AccessGate } from './client.js';

let defaultClient = null;

/**
 * Configure default AccessGate client instance
 * @param {Object} options
 */
export const initAccessGate = (options = {}) => {
  defaultClient = new AccessGate(options);
  return defaultClient;
};

/**
 * Get or automatically initialize default client
 */
export const getDefaultClient = () => {
  if (!defaultClient) {
    defaultClient = new AccessGate();
  }
  return defaultClient;
};

/**
 * Functional Express middleware to require authentication
 * @param {Object} [options]
 */
export const requireAuth = (options) => {
  const client = options instanceof AccessGate ? options : getDefaultClient();
  return client.requireAuth();
};

/**
 * Functional Express middleware to require a role
 * @param {string} roleName
 * @param {AccessGate} [client]
 */
export const requireRole = (roleName, client = null) => {
  const instance = client || getDefaultClient();
  return instance.requireRole(roleName);
};

/**
 * Functional Express middleware to require a permission
 * @param {string} permissionName
 * @param {AccessGate} [client]
 */
export const requirePermission = (permissionName, client = null) => {
  const instance = client || getDefaultClient();
  return instance.requirePermission(permissionName);
};

export default {
  initAccessGate,
  getDefaultClient,
  requireAuth,
  requireRole,
  requirePermission,
};
