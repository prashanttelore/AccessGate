import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import env from '../src/config/env.js';

describe('Environment Configuration', () => {
  it('should have required environment properties defined', () => {
    assert.ok(env.port, 'Port must be defined');
    assert.ok(env.nodeEnv, 'NodeEnv must be defined');
    assert.ok(env.dbUrl, 'DB_URL must be defined');
    assert.ok(env.redisUrl, 'REDIS_URL must be defined');
    assert.ok(env.jwtAccessSecret, 'JWT_ACCESS_SECRET must be defined');
    assert.ok(env.jwtRefreshSecret, 'JWT_REFRESH_SECRET must be defined');
  });
});
