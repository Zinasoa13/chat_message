import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards, Delete } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('rooms')
@UseGuards(AuthGuard('jwt')) // Appliquer à TOUTES les méthodes du contrôleur
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

	@Post()
	async create(@Req() req, @Body() createRoomDto: CreateRoomDto) {
	return this.roomsService.create(req.user.userId, createRoomDto);
	}

	@Get()
	async findAll(@Req() req) {
	// On passe l'ID de l'utilisateur connecté
	return this.roomsService.findAll(req.user.userId);
	}

	@Get(':id')
	async findOne(@Param('id') id: string) {
	return this.roomsService.findOne(id);
	}

	@Patch(':id')
	async update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
	return this.roomsService.update(id, updateRoomDto);
	}

	@Delete(':id')
	async remove(@Param('id') id: string) {
	return this.roomsService.remove(id);
	}

	@Post('join/:roomCode')
	async join(@Req() req, @Param('roomCode') roomCode: string) {
	return this.roomsService.join(req.user.userId, roomCode);
	}
}