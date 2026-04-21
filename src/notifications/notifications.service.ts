import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatGateway } from 'src/chat/chat.gateway';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notifModel: Model<Notification>,
	@Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway // Pour émettre en temps réel !
  ) {}

  async create(recipientId: string, type: any, content: string, senderId?: string) {
    const notif = await this.notifModel.create({
      recipient: recipientId,
      sender: senderId,
      type,
      content
    });

    // Émettre en temps réel via Socket.io
    this.chatGateway.server.to(recipientId).emit('newNotification', notif);

    return notif;
  }
}

