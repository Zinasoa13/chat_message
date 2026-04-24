import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId; // L'ID de l'utilisateur

  @Prop({ type: Types.ObjectId, ref: 'Room', required: false })
  room?: Types.ObjectId; // L'ID de la room (facultatif si recipient est présent)

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  recipient?: Types.ObjectId; // L'ID du destinataire (pour messages privés sans room)

  @Prop({ required: false })
  content?: string;

  @Prop({ default: 'text' })
  type: string;

  @Prop({ required: false })
  fileUrl?: string;

  @Prop({ required: false })
  fileType?: string;

  @Prop({ required: false })
  fileName?: string;

  @Prop({ default: false })
  isDeleted: boolean;
}


export const MessageSchema = SchemaFactory.createForClass(Message);