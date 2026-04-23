import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose'; // <-- Ajoute Types
import { Message } from './schemas/message.schema';


@Injectable()
export class ChatService {
	constructor(@InjectModel(Message.name) private messageModel: Model<Message>) {}

	async saveMessage(payload: {
		sender: string;
		room?: string;
		recipient?: string;
		content?: string;
		type?: string;
		fileUrl?: string;
		fileType?: string;
		fileName?: string;
	}): Promise<Message> {
		const createdMessage = new this.messageModel({
			sender: new Types.ObjectId(payload.sender),
			room: payload.room ? new Types.ObjectId(payload.room) : undefined,
			recipient: payload.recipient ? new Types.ObjectId(payload.recipient) : undefined,
			content: payload.content,
			type: payload.type || 'text',
			fileUrl: payload.fileUrl,
			fileType: payload.fileType,
			fileName: payload.fileName,
		});
		return await createdMessage.save();
	}

	async getMessagesByRoom(roomId: string, limit: number = 20, before?: Date): Promise<Message[]> {
		const query: any = { room: new Types.ObjectId(roomId) };
		// Si on a une date 'before', on cherche les messages créés AVANT cette date
		if (before) {
			query.createdAt = { $lt: before };
		}

		return await this.messageModel
		.find(query)
		.populate('sender', 'name picture')
		.sort({ createdAt: -1 }) // On trie du plus récent au plus vieux
		.limit(limit) // On ne prend que 20 messages
		.exec();
	}
}