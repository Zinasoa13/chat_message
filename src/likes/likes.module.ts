import { Module } from '@nestjs/common';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Like, LikeSchema } from './entities/like.entity';
import { Publication, PublicationSchema } from 'src/publication/entities/publication.entity';

@Module({
	imports: [
    MongooseModule.forFeature([{ name: Like.name, schema: LikeSchema }, { name: Publication.name, schema: PublicationSchema }])
  ],
	controllers: [LikesController],
	providers: [LikesService],
})
export class LikesModule {}
