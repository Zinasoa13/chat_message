import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatHeader } from '../chat-header/chat-header';
import { IconBtn } from '../../utils/icon-btn/icon-btn';
import { DataService } from '../../services/data.service';
import { SocketHelper } from '../../services/socket-helper';
import { Auth } from '../../services/auth';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { API_URL } from '../../utils/config';

@Component({

  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, ChatHeader, IconBtn, FormsModule],
  templateUrl: './chat-area.html',
  styleUrls: ['./chat-area.css']
})
export class ChatArea implements OnInit, OnDestroy {
  @Output() onBack = new EventEmitter<void>();
  window = window;
  messages: any[] = [];
  newMessage = '';
  activeRoomId: string | null = null;
  activeFriend: any = null;
  activeRoom: any = null;
  headerName = 'Sélectionnez une conversation';
  headerStatus = 'Hors ligne';
  headerLastSeen: any = null;
  typingUser: string | null = null;
  selectedFile: File | null = null;
  showEmojiPicker = false;
  showAttachMenu = false;
  isCameraOpen = false;
  private cameraStream: MediaStream | null = null;
  @ViewChild('cameraPreview') cameraPreview!: ElementRef<HTMLVideoElement>;
  
  // Multimedia / Audio Recording
  isRecording = false;
  recordingDuration = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingInterval: any;
  private subs = new Subscription();

  constructor(
    private dataService: DataService,
    private socketHelper: SocketHelper,
    private auth: Auth,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}


  isLoadingMore = false;
  rawMessages: any[] = []; // Garder une trace des objets messages originaux pour les dates

  ngOnInit() {
    this.subs.add(this.socketHelper.messages$.subscribe(msgs => {
      // Filtrer les messages pour ne garder que ceux de la room active
      const currentRoomId = this.activeRoomId || this.activeFriend?._id;
      const filtered = (msgs || []).filter(m => {
        const msgRoomId = m.room?._id || m.room;
        const msgSenderId = m.sender?._id || m.sender;
        const msgRecipientId = m.recipient?._id || m.recipient;

        if (this.activeRoomId) {
          return msgRoomId === this.activeRoomId;
        } else if (this.activeFriend) {
          const myId = this.auth.getUser()?._id;
          // Pour les messages privés, on vérifie soit la room privée, soit le couple sender/recipient
          return msgRoomId === this.activeRoomId || 
                 (msgSenderId === this.activeFriend._id && msgRecipientId === myId) || 
                 (msgSenderId === myId && msgRecipientId === this.activeFriend._id);
        }
        return false;
      });

      this.rawMessages = filtered;
      this.messages = this.mapMessages(this.rawMessages);
      this.cdr.detectChanges();
      if (!this.isLoadingMore) {
        setTimeout(() => this.scrollToBottom(), 100);
      } else {
        this.isLoadingMore = false;
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
      if (!data) {
        this.typingUser = null;
        this.cdr.markForCheck();
        return;
      }

      const myId = this.auth.getUser()?._id;
      const currentRoomId = this.activeRoomId || this.activeFriend?._id;
      
      // En privé, le room ID envoyé par le back peut être le REAL roomId ou le userId de l'autre
      const isTypingActive = (
          data.isTyping && 
          (data.room === currentRoomId || data.sender === currentRoomId || data.room === this.activeRoom?._id)
      );


      if (isTypingActive) {
        if (this.activeFriend && data.sender === this.activeFriend._id) {
          this.typingUser = this.activeFriend.name;
        } else if (this.activeRoom) {
          const members = this.activeRoom.members || [];
          const member = members.find((m: any) => (m._id || m) === data.sender);
          this.typingUser = member?.name || 'Quelqu\'un';
        } else {
          this.typingUser = 'Quelqu\'un';
        }
      } else {
        this.typingUser = null;
      }
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
        _id: m._id,
        content: m.isDeleted ? undefined : m.content,
        type: m.type || 'text',
        fileUrl: m.isDeleted ? undefined : this.getFullUrl(m.fileUrl),
        fileType: m.fileType,
        fileName: m.fileName,
        senderType: isSent ? 'sent' : 'received',
        photo: this.getFullUrl(m.sender?.picture),
        senderName: m.sender?.name,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
        isDeleted: !!m.isDeleted
      };
    });
  }

  deleteMessage(msg: any) {
    if (!msg || !msg._id) return;
    this.socketHelper.deleteMessage({ 
      messageId: msg._id, 
      room: this.activeRoomId || this.activeFriend?._id,
      recipientId: this.activeRoomId ? undefined : this.activeFriend?._id
    });
  }


  async downloadMedia(url: string, fileName: string) {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Erreur lors du téléchargement, retour au comportement par défaut', e);
      window.open(url, '_blank');
    }
  }



  getFullUrl(path: string): string {
    if (!path) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  }

  formatMessage(content: string): SafeHtml {
    const html = marked.parse(content || '') as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  async sendMessage() {

    if (!this.newMessage.trim() && !this.selectedFile) return;

    if (this.selectedFile) {
      this.dataService.uploadFile(this.selectedFile).subscribe({
        next: (res) => {
          this.emitSocketMessage(null, 'file', res.fileUrl, res.fileType, res.fileName);
          this.selectedFile = null;
        },
        error: (err) => console.error('Upload failed:', err)
      });
    } else {
      this.emitSocketMessage(this.newMessage, 'text');
      this.newMessage = '';
    }

    this.showEmojiPicker = false;
  }

  private emitSocketMessage(content: string | null, type: string = 'text', fileUrl?: string, fileType?: string, fileName?: string) {
    const extra = { type, fileUrl, fileType, fileName };

    if (this.activeFriend) {
      this.socketHelper.sendPrivateMessage(content || '', this.activeFriend._id, this.activeRoomId || this.activeFriend._id, extra);
    } else if (this.activeRoomId) {
      this.socketHelper.sendMessage(content || '', this.activeRoomId, extra);
    }

    const targetId = this.activeRoomId || this.activeFriend?._id;
    if (targetId) this.socketHelper.sendTyping(targetId, false);
  }

  // --- AUDIO RECORDING ---
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `vocal-${Date.now()}.webm`, { type: 'audio/webm' });
        
        this.dataService.uploadFile(file).subscribe(res => {
          this.emitSocketMessage(null, 'audio', res.fileUrl, res.fileType, res.fileName);
        });
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingDuration = 0;
      this.recordingInterval = setInterval(() => this.recordingDuration++, 1000);
    } catch (err) {
      console.error('Could not start recording', err);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      clearInterval(this.recordingInterval);
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      clearInterval(this.recordingInterval);
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.audioChunks = [];
    }
  }

  formatDuration(s: number): string {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.showAttachMenu = false;
      this.sendMessage();
    }
  }

  toggleAttachMenu() {
    this.showAttachMenu = !this.showAttachMenu;
  }

  async openCamera() {
    this.showAttachMenu = false;
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.isCameraOpen = true;
      this.cdr.detectChanges();
      if (this.cameraPreview?.nativeElement) {
        this.cameraPreview.nativeElement.srcObject = this.cameraStream;
      }
    } catch (err) {
      console.error('Erreur caméra:', err);
    }
  }

  capturePhoto() {
    if (!this.cameraPreview?.nativeElement) return;
    const video = this.cameraPreview.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });
        this.closeCamera();
        this.dataService.uploadFile(file).subscribe(res => {
          this.emitSocketMessage(null, 'image', res.fileUrl, res.fileType, res.fileName);
        });
      }
    }, 'image/png');
  }

  closeCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    this.isCameraOpen = false;
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