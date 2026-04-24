import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose'; // 1. Importe ceci
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { Friend, FriendSchema } from './entities/friend.entity'; // 2. Importe ton schéma
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [
    // 3. C'est ici que tu lies le schéma au module
    MongooseModule.forFeature([{ name: Friend.name, schema: FriendSchema }]),
	NotificationsModule,
    forwardRef(() => ChatModule)
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}