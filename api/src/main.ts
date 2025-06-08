import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable CORS for React Native app
  app.enableCors({
    origin: [
      'http://localhost:8081', // Expo dev
      'http://localhost:19006', // Expo web
      'https://wdhmlynmbrhunizbdhdt.supabase.co', // Supabase
      // Add production domains when deployed
    ],
    credentials: true,
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

  // Global prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Corporate Influence Coach API running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

// Handle serverless environments
if (require.main === module) {
  bootstrap();
}

export { bootstrap }; 