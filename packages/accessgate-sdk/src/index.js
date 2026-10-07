import { AccessGate } from './client.js';
import {
  initAccessGate,
  getDefaultClient,
  requireAuth,
  requireRole,
  requirePermission,
} from './middleware.js';

export {
  AccessGate,
  initAccessGate,
  getDefaultClient,
  requireAuth,
  requireRole,
  requirePermission,
};

export default AccessGate;
