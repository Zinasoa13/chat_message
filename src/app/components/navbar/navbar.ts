import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { SocketHelper } from '../../services/socket-helper';
import { DataService } from '../../services/data.service';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../services/theme.service';
import { API_URL } from '../../utils/config';

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
    private dataService: DataService,
    public themeService: ThemeService
  ) {}

  toggleTheme() {
    this.themeService.cycleTheme();
  }

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

    // Listen to pending requests from DataService
    this.subs.add(
      this.dataService.pendingFriends$.subscribe(pending => {
        this.pendingRequests = pending;
      })
    );

    // Initial fetch
    this.dataService.fetchNotifications();
    this.dataService.fetchPendingFriends();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
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

  acceptFriend(requestId: string) {
    this.dataService.acceptFriendRequest(requestId).subscribe({
      next: () => {
        this.pendingRequests = this.pendingRequests.filter(
          r => (r._id || r.id) !== requestId
        );
        this.dataService.fetchFriends();
        this.dataService.fetchRooms();
      },
      error: (err: any) => console.error('Accept friend failed:', err)
    });
  }

  acceptFriendFromNotif(notif: any) {
    // Retrouver la demande d'ami correspondante dans pendingRequests
    const req = this.pendingRequests.find(p => p.requester?._id === notif.sender?._id);
    if (req) {
      this.acceptFriend(req._id);
    } else {
      // Si pas trouvé dans le cache local, on refresh tout
      this.dataService.fetchPendingFriends();
    }
  }

  toggleNotifDropdown() {
    this.showNotifDropdown = !this.showNotifDropdown;
    if (this.showNotifDropdown) {
      if (this.unreadNotifs > 0) {
        this.dataService.markNotificationsAsRead().subscribe(() => {
          this.unreadNotifs = 0;
          // Optionally update local list to avoid refresh lag
          this.notifications.forEach(n => n.isRead = true);
        });
      }
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getPhotoUrl(): string {
    if (!this.user?.picture) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (this.user.picture.startsWith('http')) return this.user.picture;
    return API_URL + this.user.picture;
  }

  getFullUrl(path: string): string {
    if (!path) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (path.startsWith('http')) return path;
    return API_URL + path;
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

