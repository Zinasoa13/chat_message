import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Publication extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop()
  caption: string;

  @Prop({ required: true })
  mediaUrl: string;

  // AJOUTE CETTE LIGNE :
  @Prop({ enum: ['image', 'video'], required: true })
  mediaType: string;

  @Prop({ default: 0 })
  likesCount: number;
}
export const PublicationSchema = SchemaFactory.createForClass(Publication);
