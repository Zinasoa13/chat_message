import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketHelper } from '../../services/socket-helper';
import { Subscription } from 'rxjs';

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

  messages = [
    { sender: 'bot', content: 'Bonjour ! Je suis SOACHAN, votre assistant. Comment puis-je vous aider aujourd\'hui ?' }
  ];
  
  isBotTyping = false;
  private subs = new Subscription();

  constructor(private socket: SocketHelper) {}

  ngOnInit() {
    this.subs.add(
      this.socket.messages$.subscribe(messages => {
        if (!messages || messages.length === 0) return;
        const msg = messages[messages.length - 1];
        if (msg.sender === 'SOACHAN_ID' && !this.messages.find(m => m === msg.content)) { // Basic check
          this.isBotTyping = false;
          this.messages.push({ sender: 'bot', content: msg.content });
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
    this.socket.sendMessage('bot_channel', content);
  }
}
