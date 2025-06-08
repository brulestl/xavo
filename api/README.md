# Corporate Influence Coach API

API Gateway for the Corporate Influence Coach mobile application. Built with NestJS and optimized for serverless deployment on Cloudflare Workers/AWS Lambda.

## Features

- **Secure Authentication**: Supabase integration with JWT validation
- **Intelligent Model Routing**: Routes requests to different AI models based on user tier
- **Rate Limiting**: Built-in query limits for Essential tier users
- **Tier-based Features**: Different capabilities for Guest, Essential, and Power Strategist tiers
- **Cold-start Optimized**: Lightweight architecture for serverless environments
- **API Documentation**: Swagger/OpenAPI documentation included

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  React Native   │────│   API Gateway    │────│   Model Router      │
│     Client      │    │   (NestJS)       │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │                          │
                         ┌──────▼──────┐          ┌────────▼────────┐
                         │  Supabase   │          │  AI Models:     │
                         │    Auth     │          │  • Essential    │
                         └─────────────┘          │  • Power        │
                                                  │  • Custom GPT   │
                                                  └─────────────────┘
```

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
Create `.env` file with the following variables:
```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_key (for future integration)
CUSTOM_MODEL_ENDPOINT=your_custom_endpoint (for future integration)
```

3. **Build the application**:
```bash
npm run build
```

4. **Start development server**:
```bash
npm run start:dev
```

## API Endpoints

### Health Check
- `GET /api/v1/health` - Health check endpoint
- `GET /api/v1/` - API information

### Chat
- `POST /api/v1/chat` - Main chat endpoint (requires authentication)

## Authentication

The API uses Bearer token authentication with Supabase JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <supabase_jwt_token>
```

## User Tiers

### Guest
- Limited to basic responses
- Model: `guest-advisor`
- Max tokens: 1000

### Essential
- Basic coaching features
- 3 queries per day limit
- Model: `essential-coach-gpt`
- Max tokens: 2000

### Power Strategist
- Unlimited queries
- Advanced features and insights
- Model: `power-strategist-gpt`
- Max tokens: 4000

## Request/Response Format

### Chat Request
```json
{
  "message": "How should I approach my manager about a promotion?",
  "actionType": "plan_strategy",
  "context": [
    {
      "role": "user",
      "content": "Previous message",
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ],
  "sessionId": "session_123456"
}
```

### Chat Response
```json
{
  "id": "resp_123456",
  "message": "Here's a strategic approach for your promotion discussion...",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "session_123456",
  "model": "essential-coach-gpt",
  "usage": {
    "tokensUsed": 245,
    "remainingQueries": 2
  }
}
```

## Development

### Scripts
- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code

### API Documentation
When running in development mode, Swagger documentation is available at:
`http://localhost:3000/api/docs`

## Deployment

### Serverless Preparation
```bash
npm run serverless:build
```

### Cloudflare Workers (Coming Soon)
```bash
npm run deploy:cloudflare
```

### AWS Lambda (Coming Soon)
```bash
npm run deploy:aws
```

## Model Integration

The API is designed to route requests to different AI models based on user tier. Current implementation includes mock responses for development. To integrate with actual AI models:

1. Update `ModelRouterService` to call real AI endpoints
2. Add API keys to environment variables
3. Implement proper error handling and fallback mechanisms

## Security

- JWT validation on all protected endpoints
- Rate limiting by user tier
- Input validation with class-validator
- CORS configuration for React Native client
- Environment variable protection

## Monitoring

The API includes structured logging for:
- Request/response tracking
- Model usage statistics
- Error monitoring
- Performance metrics

## Contributing

1. Follow NestJS best practices
2. Maintain TypeScript strict mode
3. Add tests for new features
4. Update API documentation
5. Follow semantic versioning 