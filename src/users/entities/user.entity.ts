import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {
	@Prop({ unique: true })
	email: string;

	@Prop()
	name: string;

	@Prop()
	picture: string;

	@Prop({ unique: true, sparse: true })
	googleId?: string;

	@Prop({ default: 'light' })
	theme: string;

	@Prop({ default: Date.now })
	createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
