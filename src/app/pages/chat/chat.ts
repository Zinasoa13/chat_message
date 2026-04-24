import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ChatArea } from '../../components/chat-area/chat-area';
import { BotModal } from '../../components/bot-modal/bot-modal';
import { ProfileModal } from '../../components/profile-modal/profile-modal';
import { NoteList } from '../../components/note-list/note-list';
import { RoomList } from '../../components/room-list/room-list';
import { SocketHelper } from '../../services/socket-helper';
import { Calendar } from '../../components/calendar/calendar';
import { CreateGroupModal } from '../../components/create-group-modal/create-group-modal';
import { DataService } from '../../services/data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, Navbar, Sidebar, ChatArea, BotModal, ProfileModal, CreateGroupModal, NoteList, RoomList, Calendar],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css']
})
export class Chat implements OnInit, OnDestroy {
  userName: string = '';
  userPhoto: string = '';
  currentView: string = 'home';
  botOpen = false;
  profileOpen = false;
  user: any = null;
  hasActiveChat = false;
  createGroupOpen = false;
  isMobile = false;
  private subs = new Subscription();

  constructor(
    private auth: Auth,
    private router: Router,
    private socket: SocketHelper,
    public dataService: DataService
  ) {}


  @HostListener('window:resize')
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    this.isMobile = window.innerWidth <= 768;
  }


  ngOnInit() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.checkMobile();

    this.subs.add(this.dataService.view$.subscribe((view: string) => {
      this.currentView = view;
    }));

    this.subs.add(this.auth.currentUser$.subscribe(user => {
      this.user = user;
      this.userName = this.user?.name || 'Utilisateur';

      const picture = this.user?.picture;
      if (picture) {
        this.userPhoto = picture.startsWith('http') ? picture : 'http://localhost:3000' + picture;
      } else {
        this.userPhoto = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
      }
    }));

    this.socket.connect();

    this.subs.add(this.dataService.activeRoom$.subscribe(() => {
      this.updateActiveChatStatus();
    }));
    this.subs.add(this.dataService.activeFriend$.subscribe(() => {
      this.updateActiveChatStatus();
    }));
    
    this.updateActiveChatStatus();
  }

  private updateActiveChatStatus() {
    const room = this.dataService.activeRoomSubject.value;
    const friend = this.dataService.activeFriendSubject.value;
    this.hasActiveChat = !!(room || friend);
  }

  onGroupCreated(room: any) {
    this.dataService.fetchRooms();
    this.dataService.setActiveRoom(room);
  }

  closeChat() {
    this.dataService.setActiveRoom(null);
    this.dataService.setActiveFriend(null);
    this.hasActiveChat = false;
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}