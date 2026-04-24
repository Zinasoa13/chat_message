import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketHelper } from '../../services/socket-helper';
import { Subscription } from 'rxjs';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface BotMessage {
  sender: string;
  content: string;
  type?: string;
  data?: any;
}

@Component({
  selector: 'app-bot-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bot-modal.html',
  styleUrls: ['./bot-modal.css']
})
export class BotModal implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  messages: BotMessage[] = [
    { sender: 'bot', content: 'Bonjour ! Je suis SOACHAN, votre assistant. Comment puis-je vous aider aujourd\'hui ?' }
  ];

  
  isBotTyping = false;
  private subs = new Subscription();

  constructor(private socket: SocketHelper, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.subs.add(
      this.socket.messages$.subscribe(messages => {
        if (!messages || messages.length === 0) return;
        const msg = messages[messages.length - 1];
        console.log('BOT MESSAGE RECU:', msg.type, msg.data);
        
        if ((msg.sender === 'bot' || msg.sender === 'SOACHAN_ID') && !this.messages.find(m => m.content === msg.content)) {
          this.isBotTyping = false;
          this.messages.push({ 
            sender: 'bot', 
            content: msg.content,
            type: msg.type,
            data: msg.data
          });
        }
      })

    );

    // Error logging is already handled in SocketHelper
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  closeModal() {
    this.close.emit();
  }

  onInputChange(event: any) {
    const val = event.target.value;
    if (val.length > 0) {
      this.socket.sendTyping('bot_channel', true);
    } else {
      this.socket.sendTyping('bot_channel', false);
    }
  }

  sendMessage(content: string) {
    if (!content.trim()) return;
    this.messages.push({ sender: 'user', content });
    
    // Notify server we stopped typing
    this.socket.sendTyping('bot_channel', false);

    // Simulate thinking
    this.isBotTyping = true;
    this.socket.sendToBot(content);
  }

  sendReport(roomId: string, content: string) {
    this.socket.emit('sendReportToRoom', { roomId, content });
  }


  formatMessage(content: string): SafeHtml {
    const html = marked.parse(content || '') as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

