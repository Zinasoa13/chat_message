import { Injectable, NgZone } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Auth } from './auth';
import { BehaviorSubject, filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketHelper {
  private messagesSubject = new BehaviorSubject<any[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private typingSubject = new BehaviorSubject<any>(null);
  public typing$ = this.typingSubject.asObservable();

  private userStatusesSubject = new BehaviorSubject<any[]>([]);
  public userStatuses$ = this.userStatusesSubject.asObservable();
  public get userStatuses() { return this.userStatusesSubject.value; }

  private notificationsSubject = new BehaviorSubject<any[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  private friendAcceptedSubject = new BehaviorSubject<any>(null);
  public friendAccepted$ = this.friendAcceptedSubject.asObservable().pipe(filter(val => val !== null));

  private roomUpdatedSubject = new BehaviorSubject<any>(null);
  public roomUpdated$ = this.roomUpdatedSubject.asObservable().pipe(filter(val => val !== null));


  constructor(private socket: Socket, private auth: Auth, private zone: NgZone) {
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('messageHistory', (history: any[]) => {
      this.zone.run(() => this.messagesSubject.next(history || []));
    });

    this.socket.on('privateHistory', (history: any[]) => {
      this.zone.run(() => this.messagesSubject.next(history || []));
    });

    this.socket.on('moreMessageHistory', (moreHistory: any[]) => {
      this.zone.run(() => {
        const current = this.messagesSubject.value;
        this.messagesSubject.next([...moreHistory, ...current]);
      });
    });

    this.socket.on('newMessage', (msg: any) => {
      this.zone.run(() => {
        const current = this.messagesSubject.value;
        this.messagesSubject.next([...current, msg]);
      });
    });

    this.socket.on('newPrivateMessage', (msg: any) => {
      this.zone.run(() => {
        const current = this.messagesSubject.value;
        this.messagesSubject.next([...current, msg]);
      });
    });

    this.socket.on('messageDeleted', (data: { messageId: string }) => {
      this.zone.run(() => {
        const current = this.messagesSubject.value;
        const updated = current.map(msg => {
          if (msg._id === data.messageId) {
            return { ...msg, isDeleted: true, content: undefined };
          }
          return msg;
        });
        this.messagesSubject.next(updated);
      });
    });

    this.socket.on('userTyping', (data: any) => {
      this.zone.run(() => this.typingSubject.next(data));
    });

    this.socket.on('newNotification', (notif: any) => {
      this.zone.run(() => {
        this.notificationsSubject.next([notif, ...this.notificationsSubject.value]);
      });
    });

    this.socket.on('statusChanged', (data: any) => {
      this.zone.run(() => {
        const current = this.userStatusesSubject.value;
        const index = current.findIndex(s => s.userId === data.userId);
        if (index > -1) {
          current[index] = data;
          this.userStatusesSubject.next([...current]);
        } else {
          this.userStatusesSubject.next([...current, data]);
        }
      });
    });

    this.socket.on('initialStatuses', (statuses: any[]) => {
      this.zone.run(() => this.userStatusesSubject.next(statuses || []));
    });

    this.socket.on('friend_accepted', (data: any) => {
      this.zone.run(() => {
        console.log('🎉 Ami accepté:', data);
        this.friendAcceptedSubject.next(data);
      });
    });

    this.socket.on('roomUpdated', (data: any) => {
      this.zone.run(() => this.roomUpdatedSubject.next(data));
    });
  }


  connect() {
    const user = this.auth.getUser();
    if (user?._id) {
      this.socket.ioSocket.io.opts.query = { userId: user._id };
      this.socket.connect();
    }
  }

  public updateUserActivity() {
    this.socket.emit('updateUserActivity');
  }

  joinRoom(roomId: string) {
    this.messagesSubject.next([]);
    this.socket.emit('joinRoom', roomId);
  }

  public loadMoreMessages(room: string, before: Date) {
    this.socket.emit('loadMoreMessages', { room, before });
  }

  public sendMessage(content: string, roomId: string, extra?: any) {
    if (this.socket.connected) {
      const payload = { content, room: roomId, ...extra };
      this.socket.emit('sendMessage', payload);
      this.sendTyping(roomId, false);
    }
  }

  public sendToBot(content: string) {
    if (this.socket.connected) {
      this.socket.emit('sendMessage', { content, toBot: true });
      this.sendTyping('bot_channel', false);
    }
  }

  public sendPrivateMessage(content: string, recipientId: string, roomId?: string, extra?: any) {
    if (this.socket.connected) {
      const payload = { content, recipientId, ...extra };
      this.socket.emit('sendPrivateMessage', payload);
      const tid = roomId || recipientId;
      if (tid) this.sendTyping(tid, false);
    }
  }

  getPrivateHistory(recipientId: string) {
    this.messagesSubject.next([]);
    this.socket.emit('getPrivateHistory', { recipientId });
  }

  sendTyping(room: string, isTyping: boolean) {
    this.socket.emit('typing', { room, isTyping });
  }

  inviteToRoom(recipientId: string, roomCode: string, roomName: string) {
    this.socket.emit('inviteToRoom', { recipientId, roomCode, roomName });
  }

  public emit(event: string, data?: any) {
    this.socket.emit(event, data);
  }

  public deleteMessage(payload: { messageId: string, room: string, recipientId?: string }) {
    this.socket.emit('deleteMessage', payload);
  }
}