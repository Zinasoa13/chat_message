import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Note } from './entities/note.entity';
import { Model } from 'mongoose';

@Injectable()
export class NotesService {
  constructor(@InjectModel(Note.name) private noteModel: Model<Note>) {}

  async create(userId: string, createNoteDto: any) {
    return await new this.noteModel({ ...createNoteDto, owner: userId }).save();
  }

  async findAll(userId: string) {
    return await this.noteModel.find({ owner: userId }).exec();
  }

  async findOne(userId: string, id: string) {
    // On cherche l'ID ET l'owner !
    return await this.noteModel.findOne({ _id: id, owner: userId }).exec();
  }

  async remove(userId: string, id: string) {
    return await this.noteModel.findOneAndDelete({ _id: id, owner: userId }).exec();
  }
}
