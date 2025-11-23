import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import hbs from 'hbs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Настройка шаблонизатора
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Определяем путь к views в зависимости от структуры
  const viewsPath = '/app/views';

  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('hbs');

  hbs.registerHelper('json', function (context) {
    return JSON.stringify(context);
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
