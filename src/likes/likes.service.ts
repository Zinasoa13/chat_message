import { Injectable } from '@nestjs/common';
import { CreateLikeDto } from './dto/create-like.dto';
import { UpdateLikeDto } from './dto/update-like.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Publication } from 'src/publication/entities/publication.entity';
import { Like } from './entities/like.entity';
import { Model } from 'mongoose';

@Injectable()
export class LikesService {
  constructor(
    @InjectModel(Like.name) private likeModel: Model<Like>,
    @InjectModel(Publication.name) private pubModel: Model<Publication>
  ) {}

  async like(userId: string, pubId: string) {
    // 1. Sauvegarde le like
    await this.likeModel.create({ user: userId, publication: pubId });
    // 2. Incrémente le compteur sur la publication
    return await this.pubModel.findByIdAndUpdate(pubId, { $inc: { likesCount: 1 } });
  }

  async getMyLikes(userId: string) {
    // Seul l'utilisateur connecté voit ses propres likes
    return await this.likeModel.find({ user: userId }).populate('publication').exec();
  }
}
