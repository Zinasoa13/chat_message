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
  activeRoom: any = null;
  headerName = 'Sélectionnez une conversation';
  headerStatus = 'Hors ligne';
  headerLastSeen: any = null;
  isTyping = false;
  selectedFile: File | null = null;
  showEmojiPicker = false;
  private subs = new Subscription();

  constructor(
    private dataService: DataService,
    private socketHelper: SocketHelper,
    private auth: Auth,
    private cdr: ChangeDetectorRef
  ) {}

  isLoadingMore = false;
  rawMessages: any[] = []; // Garder une trace des objets messages originaux pour les dates

  ngOnInit() {
    this.subs.add(this.socketHelper.messages$.subscribe(msgs => {
      const currentRoomId = this.activeRoomId || this.activeFriend?._id;
      if (!currentRoomId) {
        this.messages = [];
        return;
      }
      // Filtrer les messages pour ne garder que ceux de la room active
      const filtered = msgs.filter(m => {
          const mRoom = m.room?.toString();
          return mRoom === currentRoomId || m.sender?._id === currentRoomId || m.sender === currentRoomId;
      });
      this.rawMessages = filtered;
      this.messages = this.mapMessages(filtered);
      this.cdr.detectChanges();
      if (!this.isLoadingMore) {
        setTimeout(() => this.scrollToBottom(), 100);
      } else {
        this.isLoadingMore = false;
        // Restaurer la position du scroll ? Ce sera fait dans onScroll via handleMoreMessages
      }
    }));

    this.subs.add(this.dataService.activeRoom$.subscribe(room => {
      if (room) {
        this.activeFriend = null;
        this.activeRoomId = room._id;
        this.activeRoom = room;
        this.headerName = room.name;
        this.headerStatus = room.status || 'offline';
        this.socketHelper.joinRoom(room._id);
      }
    }));

    // Épouser les changements en direct pour les rooms
    this.subs.add(this.dataService.userRooms$.subscribe(rooms => {
      if (this.activeRoomId) {
        const updated = rooms.find(r => r._id === this.activeRoomId);
        if (updated) {
          this.headerStatus = updated.status;
          this.cdr.markForCheck();
        }
      }
    }));

    this.subs.add(this.dataService.activeFriend$.subscribe(friend => {
      if (friend) {
        this.activeFriend = friend;
        this.activeRoomId = null;
        this.headerName = friend.name;
        this.headerStatus = friend.status || 'offline';
        this.headerLastSeen = friend.lastSeen;
        this.socketHelper.getPrivateHistory(friend._id);
      }
    }));

    // Épouser les changements en direct si on regarde un ami
    this.subs.add(this.dataService.userFriends$.subscribe(friends => {
      if (this.activeFriend) {
        const updated = friends.find(f => f._id === this.activeFriend._id);
        if (updated) {
          this.headerStatus = updated.status;
          this.headerLastSeen = updated.lastSeen;
          this.cdr.markForCheck();
        }
      }
    }));

    this.subs.add(this.socketHelper.typing$.subscribe(data => {
      const myId = this.auth.getUser()?._id;
      const currentRoomId = this.activeRoomId || this.activeFriend?._id;
      
      this.isTyping = (
          data && 
          data.isTyping && 
          data.sender !== myId && 
          (data.room === currentRoomId || data.sender === currentRoomId)
      );
      this.cdr.markForCheck();
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
    if (!this.newMessage.trim() && !this.selectedFile) return;

    if (this.activeFriend) {
      this.socketHelper.sendPrivateMessage(this.newMessage, this.activeFriend._id, this.activeRoomId || this.activeFriend._id);
    } else if (this.activeRoomId) {
      this.socketHelper.sendMessage(this.newMessage, this.activeRoomId);
    }

    const targetId = this.activeRoomId || this.activeFriend?._id;
    if (targetId) this.socketHelper.sendTyping(targetId, false);

    this.newMessage = '';
    this.selectedFile = null;
    this.showEmojiPicker = false;
  }

  onTyping(event: any) {
    const targetId = this.activeRoomId || this.activeFriend?._id;
    if (targetId) {
      this.socketHelper.sendTyping(targetId, this.newMessage.length > 0);
    }
  }

  onScroll(event: any) {
    const element = event.target;
    if (element.scrollTop === 0 && this.messages.length >= 10 && !this.isLoadingMore) {
      const oldestMsg = this.rawMessages[0];
      if (oldestMsg && oldestMsg.createdAt) {
        this.isLoadingMore = true;
        const prevHeight = element.scrollHeight;
        
        this.socketHelper.loadMoreMessages(this.activeRoomId || this.activeFriend?._id, oldestMsg.createdAt);
        
        // On attend que les messages arrivent pour ajuster le scroll
        const sub = this.socketHelper.messages$.subscribe(() => {
          setTimeout(() => {
            element.scrollTop = element.scrollHeight - prevHeight;
            sub.unsubscribe();
          }, 100);
        });
      }
    }
  }

  onType() {
    const id = this.activeRoomId || this.activeFriend?._id;
    if (id) {
      this.socketHelper.sendTyping(id, this.newMessage.length > 0);
    }
  }

  scrollToBottom() {
    const chatContainer = document.querySelector('.messages-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  ngOnDestroy() { this.subs.unsubscribe(); }
}