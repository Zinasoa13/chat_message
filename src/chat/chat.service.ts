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

	async getMessagesByRoom(roomId: string): Promise<Message[]> {
	return await this.messageModel
		.find({ room: new Types.ObjectId(roomId) })
		.populate('sender', 'name picture')
		.sort({ createdAt: 1 })
		.exec();
	}

	async getPrivateMessages(user1: string, user2: string): Promise<Message[]> {
		return await this.messageModel
			.find({
				$or: [
					{ sender: new Types.ObjectId(user1), recipient: new Types.ObjectId(user2) },
					{ sender: new Types.ObjectId(user2), recipient: new Types.ObjectId(user1) }
				]
			})
			.populate('sender', 'name picture')
			.sort({ createdAt: 1 })
			.exec();
	}
}