import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Friend extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requester: Types.ObjectId; // Celui qui demande

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId; // Celui qui reçoit

  @Prop({ enum: ['pending', 'accepted'], default: 'pending' })
  status: string;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);