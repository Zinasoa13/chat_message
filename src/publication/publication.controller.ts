import { Controller, Post, UseInterceptors, UploadedFile, Req, UseGuards, Body, Get, Param, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { PublicationService } from './publication.service';

@Controller('publications')
export class PublicationsController {
	constructor(private readonly pubService: PublicationService) {}

	@Post('upload')
	@UseGuards(AuthGuard('jwt'))
	@UseInterceptors(FileInterceptor('file')) // 'file' est le nom du champ dans le formulaire
	async uploadFile(
	@Req() req,
	@UploadedFile() file: Express.Multer.File,
	@Body() body: { caption: string }
	) {
	// Ici, 'file' contient toutes les infos (nom, buffer, taille)
	// Pour l'instant, on va sauvegarder le nom du fichier
	return this.pubService.createWithFile(req.user.userId, body.caption, file);
	}

	@Get('search')
	async search(@Query('q') query: string) {
	return await this.pubService.searchPublications(query);
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
	return this.pubService.findOne(id);
	}

	@Get('user/:authorId')
	async findByUser(@Param('authorId') authorId: string) {
	return await this.pubService.findByUser(authorId);
	}

	@Get('me')
	@UseGuards(AuthGuard('jwt'))
	async findMyPublications(@Req() req) {
		return this.pubService.findMyPublications(req.user.userId);
	}

}