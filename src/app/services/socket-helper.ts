import { Injectable, NgZone } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Auth } from './auth';
import { BehaviorSubject } from 'rxjs';

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

  public sendMessage(content: string, roomId?: string, recipientId?: string) {
    if (this.socket.connected) {
      this.socket.emit('sendMessage', { content, room: roomId, recipientId });
      if (roomId) this.sendTyping(roomId, false);
    }
  }

  public sendPrivateMessage(content: string, recipientId: string, roomId?: string) {
    if (this.socket.connected) {
      this.socket.emit('sendPrivateMessage', { content, recipientId });
      if (roomId) this.sendTyping(roomId, false);
      else if (recipientId) this.sendTyping(recipientId, false); // On utilise recipientId si pas de roomId (le back résout)
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
}