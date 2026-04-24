import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express'; // 1. Importe express
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	// 1. Active le CORS en premier pour que les requêtes static en bénéficient
	app.enableCors();

	app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

	// 2. Augmente les limites pour le JSON et le form-data (1Go)
	app.use(json({ limit: '1024mb' }));
	app.use(urlencoded({ extended: true, limit: '1024mb' }));


	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();