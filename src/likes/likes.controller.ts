import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LikesService } from './likes.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('likes')
@UseGuards(AuthGuard('jwt')) // Protégé, c'est PRIVE !
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':pubId')
  async like(@Req() req, @Param('pubId') pubId: string) {
    return this.likesService.like(req.user.userId, pubId);
  }

  @Get('my-likes')
  async getMyLikes(@Req() req) {
    return this.likesService.getMyLikes(req.user.userId);
  }
}
