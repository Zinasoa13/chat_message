import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/rooms.entity';

@Injectable()
export class RoomsService {
  constructor(@InjectModel(Room.name) private roomModel: Model<Room>) {}

	async create(userId: string, createRoomDto: CreateRoomDto): Promise<Room> {
	const code = Math.random().toString(36).substring(2, 7).toUpperCase();

	const newRoom = new this.roomModel({
		name: createRoomDto.name,
		roomCode: code,
		createdBy: userId,
		members: [userId],
		isPrivate: false, // Toujours false pour une room créée manuellement
	});

	return await newRoom.save();
	}

	async findAll(userId: string): Promise<Room[]> {
	// On cherche les rooms où le userId est dans le tableau 'members'
		return await this.roomModel
			.find({ members: userId })
			.populate('members')
			.exec();
	}

	async findOne(id: string): Promise<Room> {
	const room = await this.roomModel.findById(id).populate('members').exec();
		if (!room) throw new NotFoundException('Room introuvable');
		return room;
	}

	async update(id: string, updateRoomDto: UpdateRoomDto): Promise<Room | null> {
	return await this.roomModel.findByIdAndUpdate(id, updateRoomDto, { returnDocument: 'after' }).exec();
	}

	async remove(id: string): Promise<Room | null> {
	return await this.roomModel.findByIdAndDelete(id).exec();
	}

	async join(userId: string, roomCode: string): Promise<Room> {
		const room = await this.roomModel.findOne({roomCode}).exec()

		if (!room) {
			throw new NotFoundException(`Room avec le code ${roomCode} introuvable`)
		}

		// 2. Ajouter l'utilisateur aux membres si ce n'est pas déjà fait
		// $addToSet évite les doublons (si l'utilisateur est déjà dans la room)
		const updatedRoom = await this.roomModel.findByIdAndUpdate(
			room._id,
			{ $addToSet: {members : userId}},
			{ returnDocument: 'after' }
		).exec()

		if (!updatedRoom) {
			throw new NotFoundException('Erreur lors de la mise à jour de la room');
		}
		return updatedRoom;
	}

	async findOrCreatePrivateRoom(user1: string, user2: string): Promise<Room> {
		// Chercher une room privée qui contient EXACTEMENT ces deux membres
		let room = await this.roomModel.findOne({
			isPrivate: true,
			members: { $all: [user1, user2], $size: 2 }
		}).exec();

		if (!room) {
			// Créer une nouvelle room privée
			const code = `PV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
			room = new this.roomModel({
				name: `Private Chat`,
				roomCode: code,
				members: [user1, user2],
				isPrivate: true,
				createdBy: user1
			});
			await room.save();
		}

		return room;
	}
}
