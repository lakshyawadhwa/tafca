import { createApp } from './app.factory';

async function bootstrap() {
  const app = await createApp();

  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}

bootstrap();
