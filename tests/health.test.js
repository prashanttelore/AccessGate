import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

describe('Health Check API', () => {
  it('GET /health should return status 200 and { status: "ok" }', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    assert.deepEqual(response.body, { status: 'ok' });
  });

  it('GET /api/v1/health should return status 200 and { status: "ok" }', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect('Content-Type', /json/)
      .expect(200);

    assert.deepEqual(response.body, { status: 'ok' });
  });

  it('GET /unknown-route should return 404 NotFound error', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect('Content-Type', /json/)
      .expect(404);

    assert.equal(response.body.error, 'NotFound');
    assert.match(response.body.message, /Cannot GET \/unknown-route/);
  });
});
