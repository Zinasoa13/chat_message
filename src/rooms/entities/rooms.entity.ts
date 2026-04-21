import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({timestamps: true})
export class Room extends Document {
	@Prop({required: true})
	name: string;

	@Prop ({ required: true, unique:true})
	roomCode: string;

	@Prop({type: [Types.ObjectId], ref: 'User', default: []})
	members: Types.ObjectId[];

	@Prop({type: [Types.ObjectId], ref: 'Message', default: []})
	messages: Types.ObjectId[];

	@Prop({ default: false })
	isPrivate: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);