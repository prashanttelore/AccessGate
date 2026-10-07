import swaggerJSDoc from 'swagger-jsdoc';
import env from './env.js';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AccessGate Auth-as-a-Service API',
    version: '1.0.0',
    description:
      'Production-grade, developer-friendly Auth-as-a-Service and identity management platform providing JWT authentication, session revocation, RBAC permissions, brute-force protection, and audit logging.',
    contact: {
      name: 'AccessGate Team',
      url: 'https://github.com/prashanttelore/AccessGate',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.port}`,
      description: 'Local / Current Environment Server',
    },
    {
      url: 'https://api.accessgate.dev',
      description: 'Production Gateway',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your AccessGate JWT access token in the format: Bearer <token>',
      },
    },
    schemas: {
      StandardError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'BadRequest' },
          message: { type: 'string', example: 'Invalid request parameters' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          email: { type: 'string', format: 'email', example: 'developer@example.com' },
          name: { type: 'string', example: 'Jane Doe' },
          role: { type: 'string', example: 'user' },
          roles: { type: 'array', items: { type: 'string' }, example: ['user'] },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Tokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'string', example: '15m' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', format: 'password', example: 'SuperSecret123!' },
          name: { type: 'string', example: 'Jane Doe' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', format: 'password', example: 'SuperSecret123!' },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      RoleUpdateRequest: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', example: 'moderator' },
          action: { type: 'string', enum: ['assign', 'remove'], example: 'assign' },
        },
      },
      IntrospectRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      IntrospectResponse: {
        type: 'object',
        properties: {
          active: { type: 'boolean', example: true },
          sub: { type: 'string', format: 'uuid', example: '00000000-0000-0000-0000-000000000001' },
          user: { $ref: '#/components/schemas/User' },
          roles: { type: 'array', items: { type: 'string' }, example: ['admin'] },
          permissions: { type: 'array', items: { type: 'string' }, example: ['users:read', 'users:write'] },
          exp: { type: 'integer', example: 1728345600 },
          iat: { type: 'integer', example: 1728342000 },
          error: { type: 'string', example: 'Token has been revoked' },
        },
      },
      LoginAttempt: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          ip_address: { type: 'string', example: '192.168.1.1' },
          user_agent: { type: 'string', example: 'Mozilla/5.0...' },
          successful: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          actor_user_id: { type: 'string', format: 'uuid', nullable: true },
          action: { type: 'string', example: 'role_assigned' },
          target_user_id: { type: 'string', format: 'uuid', nullable: true },
          metadata: { type: 'object', example: { role: 'admin' } },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health Check',
        description: 'Returns the operational status of the service.',
        tags: ['System'],
        responses: {
          200: {
            description: 'Service is operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness Probe',
        description: 'Validates that PostgreSQL database and Redis connections are live.',
        tags: ['System'],
        responses: {
          200: {
            description: 'All system dependencies are healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    postgres: { type: 'boolean', example: true },
                    redis: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register User',
        description: 'Creates a new user account with hashed password and issues initial access and refresh tokens.',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'User successfully registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'User registered successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        tokens: { $ref: '#/components/schemas/Tokens' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Missing required fields',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
          409: {
            description: 'Email already registered',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate User',
        description: 'Validates email and password, checks rate limiting and brute force thresholds, logs attempt, and returns JWT tokens.',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Login successful' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        tokens: { $ref: '#/components/schemas/Tokens' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
          429: {
            description: 'Too many requests / Account temporarily locked',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate and Refresh Tokens',
        description: 'Exchanges a valid refresh token for a new access token and newly rotated refresh token.',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Tokens refreshed successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        tokens: { $ref: '#/components/schemas/Tokens' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Expired or revoked refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get Current Profile',
        description: 'Retrieves the authenticated user profile from JWT claims.',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: { user: { $ref: '#/components/schemas/User' } },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized / Missing token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout Current Session',
        description: 'Revokes the current access token and adds its ID/signature to the Redis blacklist with TTL.',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'Logged out successfully' } },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/auth/logout-all': {
      post: {
        summary: 'Logout All Sessions',
        description: 'Revokes all active refresh tokens and blacklist current access token for authenticated user across all devices.',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Logged out from all devices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Logged out from all devices successfully' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
          },
        },
      },
    },
    '/token/introspect': {
      post: {
        summary: 'Introspect Token (RFC 7662)',
        description: 'Enables external client microservices and resource servers (e.g. ShopG) to validate JWT tokens, verify active status against Redis blacklist, and retrieve user roles and permissions.',
        tags: ['Token Introspection'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IntrospectRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Token introspection status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IntrospectResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/users': {
      get: {
        summary: 'List All Users (Admin)',
        description: 'Returns a paginated list of all registered users, with optional case-insensitive email substring search. Records audit log.',
        tags: ['Admin Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 }, description: 'Items per page' },
          { in: 'query', name: 'email', schema: { type: 'string' }, description: 'Email filter' },
        ],
        responses: {
          200: {
            description: 'Paginated user list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 10 },
                    total: { type: 'integer', example: 42 },
                    totalPages: { type: 'integer', example: 5 },
                    users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                  },
                },
              },
            },
          },
          401: { description: 'Missing or invalid authentication token' },
          403: { description: 'Forbidden - requires admin role' },
        },
      },
    },
    '/admin/users/{id}/roles': {
      post: {
        summary: 'Assign / Remove Role (Admin)',
        description: 'Updates a user role (e.g. admin, moderator, user). Records role_assigned/role_removed audit log.',
        tags: ['Admin Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'User ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RoleUpdateRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'User role updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Role updated successfully' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - requires admin role' },
          404: { description: 'User not found' },
        },
      },
    },
    '/admin/users/{id}/revoke-sessions': {
      post: {
        summary: 'Force Revoke User Sessions (Admin)',
        description: 'Force revokes all active refresh tokens for the specified user (force logout). Records session_revoked audit log.',
        tags: ['Admin Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Target User ID' },
        ],
        responses: {
          200: {
            description: 'Sessions revoked',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Target user sessions revoked successfully' },
                    revokedCount: { type: 'integer', example: 3 },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Target user not found' },
        },
      },
    },
    '/admin/users/{id}/login-history': {
      get: {
        summary: 'View User Login History (Admin)',
        description: 'Retrieves recent successful and failed login attempts for a user. Records login_history_viewed audit log.',
        tags: ['Admin Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Target User ID' },
        ],
        responses: {
          200: {
            description: 'Login attempts history',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    attempts: { type: 'array', items: { $ref: '#/components/schemas/LoginAttempt' } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Target user not found' },
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        summary: 'List Audit Logs (Admin)',
        description: 'Paginated retrieval of immutable security audit logs with action and date range filters.',
        tags: ['Admin Management'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
          { in: 'query', name: 'action', schema: { type: 'string' }, description: 'Filter by action (e.g. role_assigned, session_revoked)' },
          { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date-time' }, description: 'ISO date start' },
          { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date-time' }, description: 'ISO date end' },
        ],
        responses: {
          200: {
            description: 'Paginated audit logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 10 },
                    total: { type: 'integer', example: 120 },
                    totalPages: { type: 'integer', example: 12 },
                    auditLogs: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  swaggerDefinition,
  apis: [],
});

export default swaggerSpec;
