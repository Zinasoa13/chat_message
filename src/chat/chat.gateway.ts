import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from '../notifications/notifications.service'; // Importe ton service
import { RoomsService } from '../rooms/rooms.service'; // Importe ton service
import { forwardRef, Inject } from '@nestjs/common';

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
    private readonly roomsService: RoomsService
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

    try {
      let roomDetails;

      // SI on a un recipientId, on gère la room privée automatiquement
      if (payload.recipientId) {
        roomDetails = await this.roomsService.findOrCreatePrivateRoom(userId, payload.recipientId);
        payload.room = roomDetails._id.toString(); // On injecte l'ID de la room dans le payload
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
      // Sauvegarde du message avec recipient au lieu de room
      const savedMessage = await this.chatService.saveMessage({
        sender: userId,
        recipient: payload.recipientId,
        content: payload.content,
        type: payload.type || 'text',
        fileUrl: payload.fileUrl,
        fileType: payload.fileType,
        fileName: payload.fileName,
      });

      const populatedMessage = await savedMessage.populate('sender', 'name picture');

      // Envoyer au destinataire (via sa room personnelle)
      this.server.to(payload.recipientId).emit('newPrivateMessage', populatedMessage);
      
      // Optionnel : Envoyer aussi à l'expéditeur (pour synchronisation multi-onglets)
      client.emit('newPrivateMessage', populatedMessage);

      // Notification
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
      const messages = await this.chatService.getPrivateMessages(userId, payload.recipientId);
      client.emit('privateHistory', messages);
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'historique privé : ${error.message}`);
      client.emit('error', { message: 'Impossible de récupérer l\'historique.' });
    }
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
}