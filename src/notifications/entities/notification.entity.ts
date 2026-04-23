import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class Notification extends Document { // Renommé de NotificationSchema en Notification
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sender: Types.ObjectId;

  @Prop({ required: true })
  type: 'friend_request' | 'new_message' | 'like' | 'invitation' | 'private_message';

  @Prop({ required: false })
  roomCode: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isRead: boolean;
}

// Renommé de PublicationSchema en NotificationSchema
export const NotificationSchema = SchemaFactory.createForClass(Notification);