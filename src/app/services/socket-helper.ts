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

  private notificationsSubject = new BehaviorSubject<any[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor(private socket: Socket, private auth: Auth, private zone: NgZone) {
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('messageHistory', (history: any[]) => {
      this.zone.run(() => this.messagesSubject.next(history || []));
    });

    this.socket.on('newMessage', (msg: any) => {
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
  }

  connect() {
    const user = this.auth.getUser();
    if (user?._id) {
      this.socket.ioSocket.io.opts.query = { userId: user._id };
      this.socket.connect();
    }
  }

  joinRoom(roomId: string) {
    this.messagesSubject.next([]);
    this.socket.emit('joinRoom', roomId);
  }

  sendMessage(content: string, roomId?: string, recipientId?: string) {
    this.socket.emit('sendMessage', { room: roomId, content, recipientId });
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