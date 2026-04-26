import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from '../notifications/notifications.service'; // Importe ton service
import { RoomsService } from '../rooms/rooms.service'; // Importe ton service
import { forwardRef, Inject } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { Types } from 'mongoose';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
	@WebSocketServer()
	server: Server;

	// Memory for presence
	private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>
	private userActivity = new Map<string, number>();      // userId -> timestamp

	constructor(
	private readonly chatService: ChatService,
	private readonly usersService: UsersService,
	@Inject(forwardRef(() => NotificationsService))
	private readonly notificationService: NotificationsService,
	private readonly roomsService: RoomsService,
	private readonly aiService: AiService
	) {
	}

	afterInit(server: Server) {
		// Intervalle de vérification des idle (inactifs depuis 5 min)
		setInterval(() => this.checkIdleUsers(), 30000);
	}

	public emitToUser(userId: string, event: string, data: any) {
		const sockets = this.connectedUsers.get(userId);
		if (sockets) {
			sockets.forEach(socketId => {
				this.server.to(socketId).emit(event, data);
			});
		}
	}

	private getUserId(client: Socket): string {
	const rawUserId = client.handshake.query.userId;
	return Array.isArray(rawUserId) ? rawUserId[0] : (rawUserId || '');
	}

	async handleConnection(client: Socket) {
	const userId = this.getUserId(client);
	if (userId) {
		// Gérer les sockets multiples pour un même utilisateur
		if (!this.connectedUsers.has(userId)) {
			this.connectedUsers.set(userId, new Set());
		}
		this.connectedUsers.get(userId)!.add(client.id);
		
		this.userActivity.set(userId, Date.now());
		console.log(`Presence: ${userId} est maintenant Online.`);
		
		client.join(userId);
		
		// Rejoindre toutes les rooms dont l'utilisateur est membre
		// pour recevoir les événements 'roomUpdated' en temps réel même si la room n'est pas ouverte
		const rooms = await this.roomsService.findAll(userId);
		rooms.forEach(room => {
			client.join(room._id.toString());
		});

		// Notifier les amis et envoyer le snapshot initial
		await this.usersService.updatePresence(userId, 'online', new Date());
		this.emitStatusToContacts(userId, 'online');
		this.sendInitialStatuses(client);

		this.server.emit('userOnline', userId);
	}
	}

	async handleDisconnect(client: Socket) {
	const userId = this.getUserId(client);
	if (userId) {
		const sockets = this.connectedUsers.get(userId);
		if (sockets) {
			sockets.delete(client.id);
			if (sockets.size === 0) {
				this.connectedUsers.delete(userId);
				this.userActivity.delete(userId);
				const lastSeen = new Date();
				await this.usersService.updatePresence(userId, 'offline', lastSeen);
				console.log(`Presence: ${userId} est maintenant Offline.`);
				this.emitStatusToContacts(userId, 'offline', lastSeen);
				this.server.emit('userOffline', userId);
			}
		}
	}
	}

	@SubscribeMessage('joinRoom')
	async handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
	const cleanRoomId = typeof room === 'string' ? room.replace(/"/g, '') : room;
	const userId = this.getUserId(client);

	if (userId) {
		if (!this.connectedUsers.has(userId)) {
			this.connectedUsers.set(userId, new Set());
		}
		this.connectedUsers.get(userId)!.add(client.id);
	}

	try {
		// --- ANTI-CRASH : Valider l'ID avant de chercher ---
		if (!Types.ObjectId.isValid(cleanRoomId)) {
			client.emit('error', { message: 'ID de room invalide.' });
			return;
		}

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

		const messages = await this.chatService.getMessagesByRoom(cleanRoomId, 15);
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

		// console.log('PAYLOAD:', payload); // Debug rapide

		// --- 1. LOGIQUE SOACHAN (BOT) - DOIT ÊTRE TOUT EN HAUT ---
		const isReportRequest = payload.content && payload.content.length > 10 
			? await this.aiService.detectReportIntent(payload.content) 
			: false;

		if (payload.toBot || isReportRequest) {
			try {
				let botResponse = '';
				let type = 'text';
				let extraData: any = null;

				if (isReportRequest) {

					botResponse = await this.aiService.generateReport(payload.content);
					const report = botResponse.replace(/(\r\n|\r|\n)/g, '\n');
					botResponse = `J'ai rédigé le rapport :\n\n${report}`;
					type = 'INTERACTIVE_REPORT';
					const rooms = await this.roomsService.findAll(userId);
					extraData = { 
						reportContent: report, 
						availableRooms: rooms.map(r => ({ 
							id: r._id.toString(), 
							name: r.isPrivate ? 'Conversation privée' : r.name,
							type: r.isPrivate ? 'private' : 'group'
						})) 
					};
				} else {
					// Utiliser l'IA pour une réponse générale
					botResponse = await this.aiService.generateText(payload.content);
				}

				this.server.to(client.id).emit('newMessage', {
					sender: 'bot',
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
				// --- ANTI-CRASH ---
				if (!Types.ObjectId.isValid(payload.room)) {
					client.emit('error', { message: 'ID de room invalide.' });
					return;
				}

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
		recipient: payload.recipientId,
		...payload,
		});

		const populatedMessage = await savedMessage.populate('sender', 'name picture');

		const target = this.server.to(payload.room);
		// Note: On n'envoie PAS à .to(payload.recipientId) car ça cause une fuite 
		// si l'utilisateur est dans une autre room (groupe). L'ID de room suffit.

		// --- NOUVEAU : Logique de Notifications ---
		// On envoie une notif à chaque membre sauf l'expéditeur
		if (roomDetails && roomDetails.members) {
			// Mettre à jour lastMessage + updatedAt de la room
			const now = new Date();
			await this.roomsService.update(roomDetails._id.toString(), { lastMessage: savedMessage.content, updatedAt: now } as any);

			// Émettre l'event roomUpdated pour la sidebar
			target.emit('roomUpdated', {
				roomId: roomDetails._id.toString(),
				senderId: userId,
				isPrivate: roomDetails.isPrivate,
				lastMessage: savedMessage.content,
				updatedAt: now,
			});


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

		target.emit('newMessage', populatedMessage);
	} catch (error) {

		console.error(`Erreur lors de l'envoi du message : ${error.message}`);
		client.emit('error', { message: 'Impossible d\'envoyer le message.' });
	}
  }

	@SubscribeMessage('deleteMessage')
	async handleDeleteMessage(
		@MessageBody() payload: { messageId: string, room?: string, recipientId?: string },
		@ConnectedSocket() client: Socket
	) {
		const userId = this.getUserId(client);
		try {
			await this.chatService.markMessageAsDeleted(payload.messageId, userId);
			
			// Retrouver la bonne room pour émettre
			let targetRoom = payload.room;
			if (payload.recipientId) {
				const roomDetails = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
				targetRoom = roomDetails._id.toString();
			}
			
			if (targetRoom) {
				const target = this.server.to(targetRoom);
				target.emit('messageDeleted', { messageId: payload.messageId });
			}
		} catch (error) {
			console.error(`Erreur lors de la suppression du message : ${error.message}`);
			client.emit('error', { message: 'Impossible de supprimer ce message.' });
		}
	}


	@SubscribeMessage('loadMoreMessages')

	async handleLoadMore(
	@MessageBody() payload: { room: string, before: Date },
	@ConnectedSocket() client: Socket
	) {
		const userId = this.getUserId(client);
		let targetRoomId = payload.room;

		// On vérifie si 'room' est un ID de Room ou un ID de User (pour les chats privés)
		try {
			await this.roomsService.findOne(targetRoomId);
		} catch (e) {
			// Si on ne trouve pas la room, on tente de trouver la room privée avec ce "room" (qui est donc un recipientId)
			const privateRoom = await this.roomsService.findOrCreatePrivateRoom(userId, targetRoomId);
			targetRoomId = privateRoom._id.toString();
		}

		// On charge 10 messages de plus avant la date donnée
		const messages = await this.chatService.getMessagesByRoom(targetRoomId, 10, payload.before);

		// On envoie ces messages via un événement spécifique pour la pagination
		client.emit('moreMessageHistory', messages);
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

	console.log(`[PrivateMsg] De ${userId} vers ${payload.recipientId} - Type: ${payload.type}`);

	try {
		const room = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
		const roomId = room._id.toString();
		client.join(roomId);

		const savedMessage = await this.chatService.saveMessage({
			sender: userId,
			room: roomId,
			recipient: payload.recipientId, // Utiliser recipient ou recipientId selon comment saveMessage est défini
			content: payload.content,
			type: payload.type || 'text',
			fileUrl: payload.fileUrl,
			fileType: payload.fileType,
			fileName: payload.fileName,
		});

		const populatedMessage = await savedMessage.populate('sender', 'name picture');

		// Émission du message
		this.server.to(roomId).emit('newMessage', populatedMessage);

		// Émission de roomUpdated vers la room ET directement à l'ID de l'ami (sécurité)
		const roomUpdatePayload = {
			roomId: roomId,
			senderId: userId,
			isPrivate: true,
			lastMessage: populatedMessage.type === 'text' ? populatedMessage.content : `[${populatedMessage.type}]`,
			updatedAt: (populatedMessage as any).createdAt
		};
		this.server.to(roomId).emit('roomUpdated', roomUpdatePayload);
		this.server.to(payload.recipientId).emit('roomUpdated', roomUpdatePayload);

		await this.notificationService.create(
			payload.recipientId,
			'private_message',
			`Nouveau message privé de ${populatedMessage.sender['name'] || 'quelqu\'un'}`,
			userId
		);
	} catch (error) {
		console.error(`[PrivateMsg] Erreur : ${error.message}`);
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
		const room = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
		const roomId = room._id.toString();
		client.join(roomId); // IMPORTANT: Rejoindre la room pour recevoir les futurs messages
		
		const messages = await this.chatService.getMessagesByRoom(roomId, 15);
		client.emit('privateHistory', messages);
	} catch (error) {
		console.error(`Erreur récup historique privé : ${error.message}`);
		client.emit('error', { message: 'Impossible de récupérer l\'historique.' });
	}
	}

	@SubscribeMessage('confirmSendReport')
	async confirmSend(
	@MessageBody() data: any,
	@ConnectedSocket() client: Socket
	) {
		const payload = (typeof data === 'string') ? JSON.parse(data) : data;
		const userId = this.getUserId(client);
		const roomId = payload.roomId || payload.room;

		if (!roomId || !payload.content) {
			client.emit('error', { message: 'Données manquantes' });
			return;
		}

		const savedMessage = await this.chatService.saveMessage({
			sender: userId,
			room: roomId,
			content: payload.content,
			type: 'text'
		});

		const populatedMessage = await savedMessage.populate('sender', 'name picture');
		this.server.to(roomId).emit('newMessage', populatedMessage);
	}

	@SubscribeMessage('sendReportToRoom')
	async sendReportToRoom(
		@MessageBody() payload: { roomId: string; content: string },
		@ConnectedSocket() client: Socket
	) {
		const userId = this.getUserId(client);

		if (!payload.roomId || !payload.content) {
			client.emit('error', { message: 'Données manquantes' });
			return;
		}

		try {
			const room = await this.roomsService.findOne(payload.roomId);
			const isMember = room.members.some(member =>
				(member as any)._id?.toString() === userId || member.toString() === userId
			);

			if (!isMember) {
				client.emit('error', { message: 'Accès refusé à cette room' });
				return;
			}

			const savedMessage = await this.chatService.saveMessage({
				sender: userId,
				room: payload.roomId,
				content: payload.content,
				type: 'text'
			});

			const populated = await savedMessage.populate('sender', 'name picture');
			this.server.to(payload.roomId).emit('newMessage', populated);
		} catch (error) {
			console.error(`Erreur envoi rapport : ${error.message}`);
			client.emit('error', { message: 'Erreur lors de l\'envoi du rapport.' });
		}
	}


	@SubscribeMessage('updateUserActivity')
	async handleUpdateUserActivity(@ConnectedSocket() client: Socket) {
		const userId = this.getUserId(client);
		if (!userId) return;

		this.userActivity.set(userId, Date.now());

		const user = await this.usersService.findOne(userId);
		if (user && user.status !== 'online') {
			await this.usersService.updatePresence(userId, 'online', new Date());
			this.emitStatusToContacts(userId, 'online');
		}
	}

	private async checkIdleUsers() {
		const now = Date.now();
		const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 min

		for (const [userId, lastActivity] of this.userActivity.entries()) {
			if (now - lastActivity > IDLE_THRESHOLD) {
				const user = await this.usersService.findOne(userId);
				if (user && user.status === 'online') {
					await this.usersService.updatePresence(userId, 'idle', new Date());
					this.emitStatusToContacts(userId, 'idle');
				}
			}
		}
	}

	private async emitStatusToContacts(userId: string, status: string, lastSeen?: Date) {
		const rooms = await this.roomsService.findAll(userId);
		
		for (const room of rooms) {
			const roomId = room._id.toString();
			// On émet à la room. Tous ceux qui écoutent cette room recevront le changement.
			// Pour les rooms privées, friendId == roomId (souvent).
			this.server.to(roomId).emit('statusChanged', { userId, status, lastSeen: lastSeen || new Date() });
		}
	}

	private async sendInitialStatuses(client: Socket) {
		const userId = this.getUserId(client);
		const rooms = await this.roomsService.findAll(userId);
		const allMemberIds = new Set<string>();

		for (const room of rooms) {
			if (room.members) {
				room.members.forEach(m => {
					const mId = (m as any)._id?.toString() || m.toString();
					if (mId !== userId) allMemberIds.add(mId);
				});
			}
		}

		const statuses: any[] = [];
		for (const mId of allMemberIds) {
			const user = await this.usersService.findOne(mId);
			if (user) {
				statuses.push({ userId: mId, status: user.status || 'offline', lastSeen: user.lastSeen });
			}
		}
		
		client.emit('initialStatuses', statuses);
	}

	@SubscribeMessage('typing')
	async handleTyping(
		@MessageBody() payload: { room: string; isTyping: boolean; isPrivate?: boolean },
		@ConnectedSocket() client: Socket
	) {
		const userId = this.getUserId(client);
		const user = await this.usersService.findOne(userId);
		const senderName = user?.name || 'Quelqu\'un';
		
		// Déterminer isPrivate si non fourni
		let isPrivate = payload.isPrivate;
		if (isPrivate === undefined) {
			try {
				const room = await this.roomsService.findOne(payload.room);
				isPrivate = room?.isPrivate;
			} catch (e) {
				// Si room non trouvée, c'est probablement un recipientId
				isPrivate = true;
			}
		}

		client.broadcast.to(payload.room).emit('userTyping', { 
			sender: userId, 
			senderName, 
			isPrivate,
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
			`${senderName} vous a invité à rejoindre "${payload.roomName}"`,
			userId,
			payload.roomCode
		);
	}
}