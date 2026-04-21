import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express'; // 1. Importe express
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

	// 2. Augmente les limites pour le JSON et le form-data (1Go)
	app.use(json({ limit: '1024mb' }));
	app.use(urlencoded({ extended: true, limit: '1024mb' }));

	// 3. Active le CORS (déjà fait, mais utile de le rappeler)
	app.enableCors();

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();