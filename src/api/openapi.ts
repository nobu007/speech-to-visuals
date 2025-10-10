/**
 * OpenAPI/Swagger Specification
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

export const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'AutoDiagram Video Generator API',
    version: '1.0.0',
    description: 'Enterprise API for audio-to-visual diagram video generation',
    contact: {
      name: 'API Support',
      email: 'support@autodiagram.example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server',
    },
    {
      url: 'https://api.autodiagram.example.com',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication endpoints',
    },
    {
      name: 'Transcription',
      description: 'Audio transcription endpoints',
    },
    {
      name: 'Diagram',
      description: 'Diagram generation endpoints',
    },
    {
      name: 'Video',
      description: 'Video generation endpoints',
    },
    {
      name: 'Jobs',
      description: 'Job management endpoints',
    },
    {
      name: 'System',
      description: 'System health and monitoring',
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check API server health status',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'healthy' },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        version: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'User registration',
        description: 'Register a new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/transcribe': {
      post: {
        tags: ['Transcription'],
        summary: 'Transcribe audio',
        description: 'Upload audio file for transcription',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  audio: {
                    type: 'string',
                    format: 'binary',
                    description: 'Audio file (MP3, WAV, M4A, etc.)',
                  },
                  options: {
                    type: 'string',
                    description: 'JSON string of transcription options',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Transcription job created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/api/v1/generate-diagram': {
      post: {
        tags: ['Diagram'],
        summary: 'Generate diagram',
        description: 'Generate diagram from text content',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['textContent'],
                properties: {
                  textContent: { type: 'string' },
                  options: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['auto', 'flowchart', 'hierarchy', 'network', 'timeline', 'conceptmap'],
                      },
                      layoutEngine: {
                        type: 'string',
                        enum: ['dagre', 'force', 'tree'],
                      },
                      theme: {
                        type: 'string',
                        enum: ['light', 'dark', 'auto'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Diagram generation job created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/api/v1/generate-video': {
      post: {
        tags: ['Video'],
        summary: 'Generate video',
        description: 'Generate video from diagram data',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['diagramData'],
                properties: {
                  diagramData: { $ref: '#/components/schemas/DiagramData' },
                  options: {
                    type: 'object',
                    properties: {
                      resolution: {
                        type: 'string',
                        enum: ['720p', '1080p', '4k'],
                      },
                      fps: {
                        type: 'integer',
                        enum: [30, 60],
                      },
                      quality: {
                        type: 'string',
                        enum: ['low', 'medium', 'high', 'ultra'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Video generation job created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/api/v1/jobs/{jobId}': {
      get: {
        tags: ['Jobs'],
        summary: 'Get job status',
        description: 'Retrieve status of a specific job',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job status retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
      delete: {
        tags: ['Jobs'],
        summary: 'Cancel job',
        description: 'Cancel a running job',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job cancelled',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/api/v1/jobs': {
      get: {
        tags: ['Jobs'],
        summary: 'List user jobs',
        description: 'Get all jobs for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Jobs list retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/JobStatus' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/api/v1/quota': {
      get: {
        tags: ['System'],
        summary: 'Get quota info',
        description: 'Get current user quota and usage information',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Quota information retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QuotaInfoResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
              token: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      JobStatus: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed'],
          },
          stage: {
            type: 'string',
            enum: ['transcription', 'analysis', 'visualization', 'rendering'],
          },
          progress: { type: 'number', minimum: 0, maximum: 100 },
          estimatedTimeRemaining: { type: 'number' },
          currentOperation: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      JobStatusResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/JobStatus' },
        },
      },
      DiagramData: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
        },
      },
      QuotaInfoResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              monthlyProcessingLimit: { type: 'integer' },
              monthlyProcessingUsed: { type: 'integer' },
              storageLimit: { type: 'integer' },
              storageUsed: { type: 'integer' },
              concurrentJobsLimit: { type: 'integer' },
              concurrentJobsActive: { type: 'integer' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'integer' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required or invalid token',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
};
