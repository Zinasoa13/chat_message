import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, Req, UploadedFile } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Post()
	create(@Body() createUserDto: CreateUserDto) {
	// Ici, NestJS vérifie automatiquement que le corps de la requête (Body)
	// correspond bien à ton DTO.
	return this.usersService.create(createUserDto);
	}

	@Get()
	findAll() {
	return this.usersService.findAll();
	}

	@Get('search')
	@UseGuards(AuthGuard('jwt'))
	async search(@Query('q') query: string) {
	return this.usersService.searchUsers(query);
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
	return this.usersService.findOne(id);
	}

	@Patch('me/profile-picture')
	@UseGuards(AuthGuard('jwt'))
	@UseInterceptors(FileInterceptor('file'))
	async updateProfilePicture(@Req() req, @UploadedFile() file: Express.Multer.File) {
		return this.usersService.updateProfilePicture(req.user.userId, file);
	}

	// Route pour que le front sache quels thèmes afficher
	@Get('themes')
	@UseGuards(AuthGuard('jwt'))
	async getThemes() {
	return this.usersService.getAvailableThemes();
	}

	// Route pour changer de thème
	@Patch('me/theme')
	@UseGuards(AuthGuard('jwt'))
	async updateTheme(@Req() req, @Body('themeId') themeId: string) {
	return this.usersService.updateTheme(req.user.userId, themeId);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.usersService.remove(id);
	}
}
