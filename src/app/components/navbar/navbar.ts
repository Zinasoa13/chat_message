import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { SocketHelper } from '../../services/socket-helper';
import { DataService } from '../../services/data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar implements OnInit, OnDestroy {
  @Output() onViewChange = new EventEmitter<string>();
  @Output() onOpenBot = new EventEmitter<void>();
  @Output() onOpenProfile = new EventEmitter<void>();

  currentView = 'home';
  user: any = null;
  todayDate = new Date().getDate();
  unreadNotifs = 0;
  showNotifDropdown = false;
  notifications: any[] = [];
  pendingRequests: any[] = [];
  private subs = new Subscription();

  constructor(
    private auth: Auth,
    private router: Router,
    private socketHelper: SocketHelper,
    private dataService: DataService
  ) {}

  ngOnInit() {
    this.subs.add(
      this.auth.currentUser$.subscribe(user => {
        this.user = user;
      })
    );

    // Listen to notifications from DataService (unified stream)
    this.subs.add(
      this.dataService.userNotifications$.subscribe((notifications: any[]) => {
        this.notifications = notifications;
        this.unreadNotifs = notifications.filter((n: any) => !n.isRead).length;
      })
    );

    // Initial fetch
    this.dataService.fetchNotifications();
    
    // Load pending friend requests
    this.loadPendingRequests();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  loadPendingRequests() {
    this.dataService.getPendingFriends().subscribe({
      next: (pending: any[]) => {
        this.pendingRequests = pending;
      },
      error: () => {
        this.pendingRequests = [];
      }
    });
  }

  joinGroup(roomCode: string) {
    this.dataService.joinRoom(roomCode).subscribe({
      next: (room: any) => {
        this.dataService.fetchRooms();
        this.dataService.setActiveRoom(room);
        this.showNotifDropdown = false;
      },
      error: (err: any) => console.error('Join group failed:', err)
    });
  }

  acceptFriend(userId: string) {
    this.dataService.acceptFriendRequest(userId).subscribe({
      next: () => {
        this.pendingRequests = this.pendingRequests.filter(
          r => (r._id || r.id || r.from?._id) !== userId
        );
        // Refresh friends list in sidebar
        this.dataService.fetchFriends();
        this.dataService.fetchRooms();
      },
      error: (err: any) => {
        console.error('Accept friend failed:', err);
      }
    });
  }

  toggleNotifDropdown() {
    this.showNotifDropdown = !this.showNotifDropdown;
    if (this.showNotifDropdown) {
      this.unreadNotifs = 0;
      this.loadPendingRequests();
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getPhotoUrl(): string {
    if (!this.user?.picture) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (this.user.picture.startsWith('http')) return this.user.picture;
    return 'http://localhost:3000' + this.user.picture;
  }

  setView(view: string) {
    this.currentView = view;
    this.onViewChange.emit(view);
    this.showNotifDropdown = false;
  }

  openBot() {
    this.onOpenBot.emit();
  }

  openProfile() {
    this.onOpenProfile.emit();
  }
}

