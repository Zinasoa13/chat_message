import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

@Controller('chat')
export class ChatController {
  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('Aucun fichier téléchargé');
    }

    const uploadDir = join(process.cwd(), 'uploads');

    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir);
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);

    return {
      fileUrl: `/uploads/${fileName}`,
      fileType: file.mimetype,
      fileName: file.originalname,
    };
  }
}
