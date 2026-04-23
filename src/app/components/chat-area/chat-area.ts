import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatHeader } from '../chat-header/chat-header';
import { IconBtn } from '../../utils/icon-btn/icon-btn';
import { DataService } from '../../services/data.service';
import { SocketHelper } from '../../services/socket-helper';
import { Auth } from '../../services/auth';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, ChatHeader, IconBtn, FormsModule],
  templateUrl: './chat-area.html',
  styleUrls: ['./chat-area.css']
})
export class ChatArea implements OnInit, OnDestroy {
  messages: any[] = [];
  newMessage = '';
  activeRoomId: string | null = null;
  activeFriend: any = null;
  headerName = 'Sélectionnez une conversation';
  headerStatus = 'Hors ligne';
  isTyping = false;
  private subs = new Subscription();

  constructor(
    private dataService: DataService,
    private socketHelper: SocketHelper,
    private auth: Auth,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.subs.add(this.socketHelper.messages$.subscribe(msgs => {
      this.messages = this.mapMessages(msgs);
      this.cdr.detectChanges(); // Force l'affichage immédiat
    }));

    this.subs.add(this.dataService.activeRoom$.subscribe(room => {
      if (room) {
        this.activeFriend = null;
        this.activeRoomId = room._id;
        this.headerName = room.name;
        this.headerStatus = (room.members?.length || 0) + ' membres';
        this.socketHelper.joinRoom(room._id);
      }
    }));

    this.subs.add(this.dataService.activeFriend$.subscribe(friend => {
      if (friend) {
        this.activeFriend = friend;
        this.activeRoomId = null;
        this.headerName = friend.name;
        this.headerStatus = 'En ligne';
        this.socketHelper.getPrivateHistory(friend._id);
      }
    }));

    this.subs.add(this.socketHelper.typing$.subscribe(data => {
      const myId = this.auth.getUser()?._id;
      this.isTyping = (data && data.isTyping && data.sender !== myId);
      this.cdr.detectChanges();
    }));
  }

  private mapMessages(msgs: any[]): any[] {
    const user = this.auth.getUser();
    const myId = user?._id?.toString();

    return msgs.map(m => {
      const senderId = (m.sender?._id || m.sender)?.toString();
      const isSent = senderId === myId;

      return {
        text: m.content,
        type: isSent ? 'sent' : 'received',
        // RECTIFICATION PHOTO ICI :
        photo: this.getFullUrl(m.sender?.picture),
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };
    });
  }

  getFullUrl(path: string): string {
    if (!path) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (path.startsWith('http')) return path;
    return `http://localhost:3000${path}`;
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;

    if (this.activeFriend) {
      this.socketHelper.sendMessage(this.newMessage, undefined, this.activeFriend._id);
    } else if (this.activeRoomId) {
      this.socketHelper.sendMessage(this.newMessage, this.activeRoomId);
      this.socketHelper.sendTyping(this.activeRoomId, false);
    }
    this.newMessage = '';
  }

  onType() {
    const id = this.activeRoomId || this.activeFriend?._id;
    if (id) {
      this.socketHelper.sendTyping(id, this.newMessage.length > 0);
    }
  }

  ngOnDestroy() { this.subs.unsubscribe(); }
}