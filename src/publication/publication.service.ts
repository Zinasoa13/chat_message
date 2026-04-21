import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePublicationDto } from './dto/create-publication.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import { Publication } from './entities/publication.entity';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';


@Injectable()
export class PublicationService {
  constructor(
    @InjectModel(Publication.name) private pubModel: Model<Publication>
  ) {}

  // 1. Créer une publication liée à l'auteur
	async create(userId: string, createPublicationDto: CreatePublicationDto): Promise<Publication> {
		const newPub = new this.pubModel({
			...createPublicationDto,
			author: userId,
		});
		return await newPub.save();
	}

	async createWithFile(userId: string, caption: string, file: Express.Multer.File) {
	// 1. Définir le chemin du dossier
	const uploadDir = join(process.cwd(), 'uploads');

	// 2. Vérifier si le dossier existe, sinon le créer
	if (!existsSync(uploadDir)) {
	mkdirSync(uploadDir);
	}

	// 3. Créer le nom et sauvegarder
	const fileName = `${Date.now()}-${file.originalname}`;
	writeFileSync(join(uploadDir, fileName), file.buffer);

	// 4. Sauvegarder en DB
	return await this.pubModel.create({
	author: userId,
	caption,
	mediaUrl: `/uploads/${fileName}`,
	mediaType: file.mimetype.startsWith('video') ? 'video' : 'image',
	});
	}

	async searchPublications(query: string): Promise<Publication[]> {
	return await this.pubModel
	.find({
		caption: { $regex: query, $options: 'i' } // 'i' = insensible à la casse
	})
	.sort({ likesCount: -1 }) // -1 = Tri décroissant (les plus likés d'abord)
	.populate('author', 'name picture')
	.exec();
	}

	async findByUser(authorId: string): Promise<Publication[]> {
	return await this.pubModel.find({ author: authorId }).exec();
	}
	// 2. Voir toutes les publications (Le feed public)
	async findAll(): Promise<Publication[]> {
	return await this.pubModel.find().populate('author', 'name picture').exec();
	}

	// 3. Voir une seule publication
	async findOne(id: string): Promise<Publication> {
	const pub = await this.pubModel.findById(id).populate('author', 'name picture').exec();
	if (!pub) throw new NotFoundException('Publication introuvable');
	return pub;
	}

	async findMyPublications(userId: string) {
	// C'est ça qui fait la "magie" : il filtre par l'ID de l'auteur
	return await this.pubModel
		.find({ author: userId })
		.sort({ createdAt: -1 }) // Les plus récentes en premier
		.exec();
	}



	// 4. Mettre à jour (optionnel)
	async update(id: string, updatePublicationDto: UpdatePublicationDto): Promise<Publication | null> {
	return await this.pubModel.findByIdAndUpdate(id, updatePublicationDto, { new: true }).exec();
	}

	// 5. Supprimer
	async remove(id: string) {
	const deleted = await this.pubModel.findByIdAndDelete(id).exec();
	if (!deleted) throw new NotFoundException('Publication introuvable');
	return deleted;
	}
}