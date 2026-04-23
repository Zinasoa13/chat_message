import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from '../notifications/notifications.service'; // Importe ton service
import { RoomsService } from '../rooms/rooms.service'; // Importe ton service
import { forwardRef, Inject } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	private connectedUsers = new Map<string, string>();

	constructor(
	private readonly chatService: ChatService,
	private readonly usersService: UsersService,
	@Inject(forwardRef(() => NotificationsService))
	private readonly notificationService: NotificationsService,
	private readonly roomsService: RoomsService,
	private readonly aiService: AiService
	) {}

	private getUserId(client: Socket): string {
	const rawUserId = client.handshake.query.userId;
	return Array.isArray(rawUserId) ? rawUserId[0] : (rawUserId || '');
	}

	handleConnection(client: Socket) {
	const userId = this.getUserId(client);
	if (userId) {
		this.connectedUsers.set(userId, client.id);
		client.join(userId); // Chaque utilisateur rejoint sa propre room (ID)
		console.log(`Utilisateur connecté: ${userId} sur le socket ${client.id}`);
		this.server.emit('userOnline', userId);
	}
	}

	handleDisconnect(client: Socket) {
	const userId = this.getUserId(client);
	if (userId) {
		this.connectedUsers.delete(userId);
		console.log(`Client ${client.id} (user: ${userId}) déconnecté.`);
		this.server.emit('userOffline', userId);
	}
	}

	@SubscribeMessage('joinRoom')
	async handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
	const cleanRoomId = typeof room === 'string' ? room.replace(/"/g, '') : room;
	const userId = this.getUserId(client);

	if (userId) {
		this.connectedUsers.set(userId, client.id);
	}

	try {
		// Vérifier si la room existe et si l'utilisateur est membre
		const roomDetails = await this.roomsService.findOne(cleanRoomId);
		const isMember = roomDetails.members.some(member =>
		(member as any)._id?.toString() === userId || member.toString() === userId
		);

		if (!isMember) {
		console.warn(`Tentative de joinRoom refusée : l'utilisateur ${userId} n'est pas membre de la room ${cleanRoomId}`);
		client.emit('error', { message: 'Vous n\'avez pas accès à cette room.' });
		return;
		}

		client.join(cleanRoomId);

		const socketsInRoom = await this.server.in(cleanRoomId).fetchSockets();
		const usersInRoom = Array.from(new Set(socketsInRoom.map(socket => {
		const uId = socket.handshake.query.userId;
		return Array.isArray(uId) ? uId[0] : uId;
		}).filter(Boolean)));

		console.log(`Utilisateurs dans la room ${cleanRoomId}:`, usersInRoom);
		this.server.to(cleanRoomId).emit('usersInRoom', usersInRoom);

		const messages = await this.chatService.getMessagesByRoom(cleanRoomId);
		client.emit('messageHistory', messages);
	} catch (error) {
		console.error(`Erreur lors du joinRoom : ${error.message}`);
		client.emit('error', { message: 'Erreur lors de l\'accès à la room.' });
	}
	}

	@SubscribeMessage('sendMessage')
	async handleMessage(
	@MessageBody() data: any,
	@ConnectedSocket() client: Socket
	) {
		const payload = data.room ? data : (typeof data === 'string' ? JSON.parse(data) : data);
		const userId = this.getUserId(client);

		if (!userId) throw new Error('Utilisateur non identifié');

			// --- 1. LOGIQUE SOACHAN (BOT) ---
		// On intercepte si c'est explicitement pour le bot ou si le contenu commence par "rédige un rapport"
		if ((payload.content && payload.content.toLowerCase().startsWith('rédige un rapport')) || payload.toBot) {
			try {
				let botResponse = '';
				let type = 'text';
				let extraData: any = null;

				if (payload.content.toLowerCase().startsWith('rédige un rapport')) {
					botResponse = await this.aiService.generateReport(payload.content);
					const report = botResponse.replace(/(\r\n|\r|\n)/g, '\n');
					botResponse = `J'ai rédigé le rapport :\n\n${report}`;
					type = 'INTERACTIVE_DRAFT';
					const rooms = await this.roomsService.findAll(userId);
					extraData = { reportContent: report, availableRooms: rooms.map(r => ({ id: r._id, name: r.name })) };
				} else {
					// Utiliser l'IA pour une réponse générale
					botResponse = await this.aiService.generateReport(payload.content); // On réutilise generateReport pour l'instant
				}

				this.server.to(client.id).emit('newMessage', {
					sender: 'SOACHAN_ID',
					content: botResponse,
					type: type,
					data: extraData
				});
				return;
			} catch (e) {
				console.error('Erreur IA:', e);
				client.emit('error', { message: 'Erreur lors de la communication avec SOACHAN.' });
				return;
			}
		}

		try {
			let roomDetails;


			// SI on a un recipientId, on gère la room privée automatiquement
			if (payload.recipientId) {
			roomDetails = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
			payload.room = roomDetails._id.toString(); // On injecte l'ID de la room dans le payload
			client.join(payload.room); // S'assurer que le client est dans la room
			} else if (payload.room) {
			// Logique habituelle pour les rooms de groupe
			roomDetails = await this.roomsService.findOne(payload.room);
			const isMember = roomDetails.members.some(member =>
				(member as any)._id?.toString() === userId || member.toString() === userId
			);

			if (!isMember) {
				console.warn(`Tentative d'envoi de message refusée : l'utilisateur ${userId} n'est pas membre de la room ${payload.room}`);
				client.emit('error', { message: 'Vous n\'êtes pas membre de cette room, envoi refusé.' });
				return;
			}
		} else {
		throw new Error('Ni room ni recipientId fourni');
		}

			// Sauvegarde du message
		const savedMessage = await this.chatService.saveMessage({
		sender: userId,
		...payload,
		});

		const populatedMessage = await savedMessage.populate('sender', 'name picture');

		// --- NOUVEAU : Logique de Notifications ---
		// On envoie une notif à chaque membre sauf l'expéditeur
		if (roomDetails && roomDetails.members) {
		for (const member of roomDetails.members) {
			const memberId = (member as any)._id?.toString() || member.toString();
			if (memberId !== userId) {
			await this.notificationService.create(
				memberId,
				'new_message',
				`Nouveau message de ${populatedMessage.sender['name'] || 'quelqu\'un'}`,
				userId
			);
			}
		}
	}

	this.server.to(payload.room).emit('newMessage', populatedMessage);
	} catch (error) {
		console.error(`Erreur lors de l'envoi du message : ${error.message}`);
		client.emit('error', { message: 'Impossible d\'envoyer le message.' });
	}
  }

	@SubscribeMessage('loadMoreMessages')
	async handleLoadMore(
	@MessageBody() payload: { room: string, before: Date },
	@ConnectedSocket() client: Socket
	) {
	// On charge 20 messages de plus avant la date donnée
	const messages = await this.chatService.getMessagesByRoom(payload.room, 20, payload.before);

	// On envoie ces messages à l'utilisateur qui a scrollé
	client.emit('messageHistory', messages);
	}

	@SubscribeMessage('sendPrivateMessage')
	async handlePrivateMessage(
	@MessageBody() data: any,
	@ConnectedSocket() client: Socket
	) {
	const payload = typeof data === 'string' ? JSON.parse(data) : data;
	const userId = this.getUserId(client);

	if (!userId) throw new Error('Utilisateur non identifié');
	if (!payload.recipientId) throw new Error('Destinataire manquant');

	try {
		// 1. Trouver ou créer la room privée
		const room = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
		const roomId = room._id.toString();

		// S'assurer que le client a rejoint la room du socket pour cette conversation
		client.join(roomId);

		// 2. Sauvegarde du message associé à la room
		const savedMessage = await this.chatService.saveMessage({
			sender: userId,
			room: roomId, // On utilise roomId au lieu de recipient
			content: payload.content,
			type: payload.type || 'text',
			fileUrl: payload.fileUrl,
			fileType: payload.fileType,
			fileName: payload.fileName,
		});

		const populatedMessage = await savedMessage.populate('sender', 'name picture');

		// 3. Diffuser à la room (les deux participants)
		this.server.to(roomId).emit('newPrivateMessage', populatedMessage);
		
		// Note: On émet aussi 'newMessage' pour la compatibilité avec certains composants front
		this.server.to(roomId).emit('newMessage', populatedMessage);

		// 4. Notification
		await this.notificationService.create(
			payload.recipientId,
			'private_message',
			`Nouveau message privé de ${populatedMessage.sender['name'] || 'quelqu\'un'}`,
			userId
		);

	} catch (error) {
		console.error(`Erreur lors de l'envoi du message privé : ${error.message}`);
		client.emit('error', { message: 'Impossible d\'envoyer le message privé.' });
	}
	}

	@SubscribeMessage('getPrivateHistory')
	async handleGetPrivateHistory(
	@MessageBody() payload: { recipientId: string },
	@ConnectedSocket() client: Socket
	) {
	const userId = this.getUserId(client);
	if (!userId) throw new Error('Utilisateur non identifié');

	try {
		// Résoudre la room privée d'abord
		const room = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
		
		// Récupérer les messages par roomId
		const messages = await this.chatService.getMessagesByRoom(room._id.toString());
		client.emit('privateHistory', messages);
	} catch (error) {
		console.error(`Erreur lors de la récupération de l'historique privé : ${error.message}`);
		client.emit('error', { message: 'Impossible de récupérer l\'historique.' });
	}
	}

	@SubscribeMessage('confirmSendReport')
	async confirmSend(
	@MessageBody() data: any,
	@ConnectedSocket() client: Socket
	) {
	// 1. Parsing robuste : traite les cas où Hoppscotch envoie du JSON en string
		const payload = (typeof data === 'string') ? JSON.parse(data) : data;

		// LOG CRUCIAL pour voir ce qu'on reçoit vraiment
		console.log('DONNÉES REÇUES DANS CONFIRM_SEND:', payload);

		const userId = this.getUserId(client);

		// 2. Sécurité sur le roomId
		// Vérifie si le champ s'appelle 'roomId' ou 'room'
		const roomId = payload.roomId || payload.room;

		if (!roomId || !payload.content) {
		console.error('Erreur : roomId ou content manquant dans le payload', payload);
		client.emit('error', { message: 'Données manquantes pour envoyer le rapport' });
		return;
		}

		// 3. Sauvegarde
		const savedMessage = await this.chatService.saveMessage({
		sender: userId,
		room: roomId,
		content: payload.content,
		type: 'text'
	});

	// 4. Populate
	const populatedMessage = await savedMessage.populate('sender', 'name picture');

	// 5. Diffusion
	this.server.to(roomId).emit('newMessage', populatedMessage);

	console.log(`Rapport envoyé automatiquement par ${userId} dans la room ${roomId}`);
	}

	@SubscribeMessage('typing')
	handleTyping(
	@MessageBody() payload: { room: string; isTyping: boolean },
	@ConnectedSocket() client: Socket
	) {
	const userId = this.getUserId(client);
	client.broadcast.to(payload.room).emit('userTyping', {
		sender: userId,
		...payload
	});
	}

	@SubscribeMessage('inviteToRoom')
	async handleInviteToRoom(
		@MessageBody() payload: { recipientId: string, roomCode: string, roomName: string },
		@ConnectedSocket() client: Socket
	) {
		const userId = this.getUserId(client);
		if (!userId) return;

		const user = await this.usersService.findOne(userId);
		const senderName = user?.name || 'Un ami';

		await this.notificationService.create(
			payload.recipientId,
			'invitation',
			`${senderName} vous a invité à rejoindre "${payload.roomName}" (Code: ${payload.roomCode})`,
			userId,
			payload.roomCode
		);
	}
}