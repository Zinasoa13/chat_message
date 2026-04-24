import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Friend } from './entities/friend.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { forwardRef, Inject } from '@nestjs/common';
import { ChatGateway } from 'src/chat/chat.gateway';

@Injectable()
export class FriendsService {
	constructor(@InjectModel(Friend.name) private friendModel: Model<Friend>,
	private notificationService: NotificationsService,
	@Inject(forwardRef(() => ChatGateway))
	private chatGateway: ChatGateway
	) {}

	async getMyFriends(userId: string) {
	return await this.friendModel.find({
	$or: [{ requester: userId }, { recipient: userId }],
	status: 'accepted'
	}).populate('requester recipient', 'name picture'); // Affiche nom et photo
	}

	// 1. Envoyer une demande
	async sendRequest(requesterId: string, recipientId: string) {
	const newRequest = new this.friendModel({
		requester: requesterId,
		recipient: recipientId,
		status: 'pending',
	});

	// Tu appelles la notif ici !
	await this.notificationService.create(
		recipientId,
		'friend_request',
		'Vous avez reçu une demande d\'ami',
		requesterId
	);
	return await newRequest.save();
	}

	// 2. Accepter une demande
	async acceptRequest(requestId: string, userId: string) {
	// On met à jour seulement si le recipient est bien l'utilisateur connecté
	const result = await this.friendModel.findOneAndUpdate(
	{ _id: requestId, recipient: userId, status: 'pending' },
	{ status: 'accepted' },
	{ new: true }
	).exec();

	if (!result) {
	throw new NotFoundException('Demande introuvable ou déjà traitée');
	}

	// Informer le demandeur que son invitation a été acceptée (en temps réel)
	this.chatGateway.emitToUser(result.requester.toString(), 'friend_accepted', { requester: result.requester, recipient: result.recipient });

	return result;
	}

	// 3. Voir mes demandes en attente (reçues)
	async getPendingRequests(userId: string) {
	return await this.friendModel
	.find({ recipient: userId, status: 'pending' })
	.populate('requester', 'name picture') // <-- C'EST ÇA QUI MANQUE
	.exec();
	}
}