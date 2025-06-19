import { config } from 'dotenv';
import { resolve } from 'path';

// before anything else:
config({
  path: resolve(__dirname, '../.env'),
});

// now the rest of your imports
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

console.log('Loading .env from:', resolve(__dirname, '../.env'));
console.log('OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY);
console.log('SUPABASE_URL loaded:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY loaded:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Available Supabase env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable CORS for React Native app
  app.enableCors({
    origin: true, // Allow all origins for development (Android emulator/device)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation for development
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Corporate Influence Coach API')
      .setDescription('API Gateway for AI-powered corporate coaching')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('chat', 'Chat endpoints')
      .addTag('auth', 'Authentication')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Set global prefix to match frontend expectations
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Corporate Influence Coach API running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🔗 Chat endpoint available at: http://localhost:${port}/api/v1/chat`);
}

// Handle serverless environments
if (require.main === module) {
  bootstrap();
}

export { bootstrap }; 