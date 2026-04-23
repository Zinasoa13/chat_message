import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Avatar } from '../../utils/avatar/avatar';
import { IconBtn } from '../../utils/icon-btn/icon-btn';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  imports: [CommonModule, Avatar, IconBtn],
  templateUrl: './chat-header.html',
  styleUrls: ['./chat-header.css']
})
export class ChatHeader {
  @Input() userName: string = 'Alexander Jameson';
  @Input() status: string = 'Online';
  @Input() userPicture?: string;
}
