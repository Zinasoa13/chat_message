import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const AVAILABLE_THEMES = [
  { id: 'light', name: 'Blanc pur', type: 'color', value: '#FFFFFF' },
  { id: 'dark', name: 'Sombre moderne', type: 'color', value: '#121212' },
  { id: 'pastel', name: 'Rose pastel', type: 'color', value: '#FFD1DC' },
  { id: 'nature', name: 'Forêt enchantée', type: 'image', value: 'https://images.unsplash.com/photo-1448375240586-4527e761d763' },
  { id: 'space', name: 'Nébuleuse', type: 'image', value: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa' },
];

@Injectable()
export class UsersService {
	constructor(@InjectModel(User.name) private userModel: Model<User>) {}

	async create(createUserDto: CreateUserDto): Promise<User> {
	const createdUser = new this.userModel(createUserDto);
	return await createdUser.save();
	}

	async findOrCreateByGoogle(profile: any): Promise<User> {
		console.log('Profil reçu de Google:', JSON.stringify(profile, null, 2));

		const { id, emails, name, photos } = profile;

		// Extraction sécurisée des données
		const googleId = id;
		const email = (emails && emails.length > 0) ? emails[0].value : null;
		const picture = (photos && photos.length > 0) ? photos[0].value : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
		const displayName = name ? `${name.givenName} ${name.familyName}` : 'Utilisateur Google';

		if (!googleId) {
			throw new Error('Google ID is missing from profile');
		}

		// On cherche par Google ID
		let user = await this.userModel.findOne({ googleId }).exec();

		// Si pas trouvé par ID, on peut aussi chercher par email (au cas où l'utilisateur existait déjà via une autre méthode)
		if (!user && email) {
			user = await this.userModel.findOne({ email }).exec();
			if (user) {
				// On lie le compte Google à l'utilisateur existant
				user.googleId = googleId;
				await user.save();
			}
		}

		if (!user) {
			user = new this.userModel({
				googleId,
				email,
				name: displayName,
				picture,
			});
			await user.save();
			console.log('Nouvel utilisateur créé:', user.email);
		} else {
			console.log('Utilisateur existant trouvé:', user.email);
		}

		return user;
	}

	async updateProfilePicture(userId: string, file: Express.Multer.File) {
		// 1. Sauvegarde le fichier (comme pour les publications)
		const fileName = `${Date.now()}-${file.originalname}`;
		writeFileSync(join(process.cwd(), 'uploads', fileName), file.buffer);

		// 2. Met à jour le champ 'picture' dans la collection 'users'
		return await this.userModel.findByIdAndUpdate(
			userId,
			{ picture: `/uploads/${fileName}` },
			{ new: true }
		).exec();
	}

	async findAll(): Promise<User[]> {
	return await this.userModel.find().exec();
	}

	async findOne(id: string): Promise<User | null> {
	return await this.userModel.findById(id).exec();
	}

	async findByEmail(email: string): Promise<User | null> {
	return await this.userModel.findOne({ email }).exec();
	}

	async searchUsers(query: string): Promise<User[]> {
		if (!query) return [];

		// 'i' signifie "insensible à la casse" (A = a)
		return await this.userModel.find({
		name: { $regex: query, $options: 'i' }
		}).select('name picture email').exec(); // On ne renvoie que ce dont on a besoin
	}

	async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
	return await this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
	}

		// 1. Retourne la liste pour ton frontend
	getAvailableThemes() {
	return AVAILABLE_THEMES;
	}

	// 2. Validation et Sauvegarde
	async updateTheme(userId: string, themeId: string) {
	const themeExists = AVAILABLE_THEMES.find(t => t.id === themeId);
	if (!themeExists) throw new BadRequestException('Thème inconnu');

	return await this.userModel.findByIdAndUpdate(
		userId,
		{ theme: themeId }, // On enregistre juste l'ID du thème (ex: 'nature')
		{ new: true }
	).exec();
	}

	async remove(id: string): Promise<User | null> {
	return await this.userModel.findByIdAndDelete(id).exec();
	}
}
