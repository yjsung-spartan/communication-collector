export const openAPISchema = {
  openapi: '3.0.0',
  info: {
    title: 'Communication Collector API',
    version: '1.0.0',
    description: 'API for collecting and analyzing customer requests from multiple sources (Confluence, Figma, Slack)'
  },
  servers: [
    {
      url: 'https://weplanet-slack-5qjhowyjo-yjsungs-projects.vercel.app',
      description: 'Production server'
    }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Check if the API is running',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    mode: { type: 'string', example: 'simple-cache' },
                    cacheAge: { type: 'string', example: '120s' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/requests': {
      get: {
        summary: 'Get customer requests',
        description: 'Retrieves all customer requests with filtering options',
        parameters: [
          {
            name: 'project',
            in: 'query',
            description: 'Filter by project (fanlight, momgleedu, all)',
            required: false,
            schema: {
              type: 'string',
              default: 'all',
              enum: ['fanlight', 'momgleedu', 'all']
            }
          },
          {
            name: 'days',
            in: 'query',
            description: 'Number of days to look back',
            required: false,
            schema: {
              type: 'integer',
              default: 30
            }
          },
          {
            name: 'source',
            in: 'query',
            description: 'Filter by source',
            required: false,
            schema: {
              type: 'string',
              default: 'all',
              enum: ['confluence', 'figma', 'slack', 'all']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    timestamp: { type: 'string', format: 'date-time' },
                    total: { type: 'number' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          crNumber: { type: 'string' },
                          source: { type: 'string', enum: ['confluence', 'figma', 'slack'] },
                          sourceId: { type: 'string' },
                          requesterName: { type: 'string' },
                          title: { type: 'string' },
                          description: { type: 'string' },
                          category: { type: 'string' },
                          priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
                          channelName: { type: 'string' },
                          originalUrl: { type: 'string' },
                          requestedAt: { type: 'string', format: 'date-time' },
                          daysElapsed: { type: 'number' },
                          status: { type: 'string' },
                          collectedAt: { type: 'string', format: 'date-time' }
                        }
                      }
                    },
                    filters: {
                      type: 'object',
                      properties: {
                        project: { type: 'string' },
                        days: { type: 'number' },
                        source: { type: 'string' }
                      }
                    },
                    sources: {
                      type: 'object',
                      properties: {
                        slack: { type: 'number' },
                        figma: { type: 'number' },
                        confluence: { type: 'number' }
                      }
                    },
                    responseTime: { type: 'string' }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/summary': {
      get: {
        summary: 'Get summary statistics',
        description: 'Returns aggregated statistics about customer requests',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    timestamp: { type: 'string', format: 'date-time' },
                    stats: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        bySource: {
                          type: 'object',
                          properties: {
                            confluence: { type: 'number' },
                            figma: { type: 'number' },
                            slack: { type: 'number' }
                          }
                        },
                        byPriority: {
                          type: 'object',
                          properties: {
                            high: { type: 'number' },
                            medium: { type: 'number' },
                            low: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/requests/llm': {
      get: {
        summary: 'Get LLM-formatted requests',
        description: 'Returns requests in a format optimized for LLM processing',
        parameters: [
          {
            name: 'project',
            in: 'query',
            description: 'Filter by project',
            required: false,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    timestamp: { type: 'string', format: 'date-time' },
                    data: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        requests: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              source: { type: 'string' },
                              author: { type: 'string' },
                              content: { type: 'string' },
                              timestamp: { type: 'string', format: 'date-time' },
                              priority: { type: 'string' },
                              originalUrl: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};