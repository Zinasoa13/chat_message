import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document,Types } from "mongoose"; //always import Document if we user it in code cuz it's useful

@Schema({ timestamps: true })
export class Note extends Document {
	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	owner: Types.ObjectId; // Seul le propriétaire peut voir

	@Prop({ required: true })
	title: string;

	@Prop()
	content: string;

	@Prop({ default: false })
	isCompleted: boolean;
}

export const NoteSchema = SchemaFactory.createForClass(Note);