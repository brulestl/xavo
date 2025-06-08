import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Corporate Influence Coach API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  getApiInfo(): object {
    return {
      name: 'Corporate Influence Coach API',
      version: '1.0.0',
      description: 'API Gateway for AI-powered corporate coaching',
      endpoints: {
        health: '/api/v1/health',
        chat: '/api/v1/chat',
        docs: '/api/docs',
      },
      timestamp: new Date().toISOString(),
    };
  }
} 