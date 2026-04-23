import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { Auth } from '../../services/auth';
import { Avatar } from '../../utils/avatar/avatar';

@Component({
  selector: 'app-room-members-modal',
  standalone: true,
  imports: [CommonModule, Avatar],
  templateUrl: './room-members-modal.html',
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      animation: fadeIn 0.3s ease-out;
    }

    .modal-card {
      background: white;
      width: 400px;
      max-width: 90%;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .modal-header {
      padding: 24px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.4);
    }

    .members-list {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }

    .member-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 16px;
      transition: background 0.2s;
      gap: 12px;
    }

    .member-item:hover {
      background: #f8fafc;
    }

    .member-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .member-name {
      font-weight: 600;
      color: #1e293b;
    }

    .member-status-text {
      font-size: 12px;
      color: #64748b;
    }

    .status-online { color: #10b981; }
    .status-idle { color: #f59e0b; }
    .status-offline { color: #94a3b8; }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { transform: translateY(20px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
  `]
})
export class RoomMembersModalComponent {
  @Input() isOpen = false;
  @Input() room: any = null;
  @Output() close = new EventEmitter<void>();

  private dataService = inject(DataService);
  private auth = inject(Auth);

  getMemberStatus(member: any) {
    const userId = member._id || member;
    const myId = this.auth.getUser()?._id;
    
    if (userId === myId) return { status: 'online' };
    return this.dataService.getStatus(userId);
  }

  getStatusLabel(member: any): string {
    const s = this.getMemberStatus(member);
    if (!s || s.status === 'offline') {
      if (s?.lastSeen) {
        const date = new Date(s.lastSeen);
        return `Vu à ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      return 'Hors ligne';
    }
    return s.status === 'online' ? 'En ligne' : 'Inactif';
  }

  getStatusClass(member: any): string {
    const s = this.getMemberStatus(member);
    return `status-${s?.status || 'offline'}`;
  }

  onClose() {
    this.close.emit();
  }
}
