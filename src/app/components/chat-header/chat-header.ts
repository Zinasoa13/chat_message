import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Avatar } from '../../utils/avatar/avatar';
import { IconBtn } from '../../utils/icon-btn/icon-btn';
import { RoomMembersModalComponent } from '../room-members-modal/room-members-modal';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  imports: [CommonModule, Avatar, IconBtn, RoomMembersModalComponent],
  templateUrl: './chat-header.html',
  styleUrls: ['./chat-header.css']
})
export class ChatHeader {
  @Input() userName: string = '';
  @Input() status: string = 'offline';
  @Input() userPicture?: string;
  @Input() lastSeen?: any;
  @Input() isGroup: boolean = false;
  @Input() activeRoom: any = null;

  showMembersModal = false;

  getStatusText(): string {
    if (this.status === 'online') return 'En ligne';
    if (this.status === 'idle') return 'Inactif';
    if (this.status === 'offline' && this.lastSeen) {
      const date = new Date(this.lastSeen);
      return `Vu à ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Hors ligne';
  }

  toggleMembersModal() {
    this.showMembersModal = !this.showMembersModal;
  }
}
