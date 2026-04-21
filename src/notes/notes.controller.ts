import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { NotesService } from './notes.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('notes')
@UseGuards(AuthGuard('jwt')) // Protégé !
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Req() req, @Body() createNoteDto: any) {
    return this.notesService.create(req.user.userId, createNoteDto);
  }

  @Get()
  findAll(@Req() req) {
    return this.notesService.findAll(req.user.userId);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.notesService.remove(req.user.userId, id);
  }
}
