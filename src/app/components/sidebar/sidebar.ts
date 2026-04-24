import { Component, OnInit, OnDestroy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Avatar } from '../../utils/avatar/avatar';
import { CreateGroupModal } from '../create-group-modal/create-group-modal';
import { DataService } from '../../services/data.service';
import { Auth } from '../../services/auth';
import { SocketHelper } from '../../services/socket-helper';
import { Subscription, Subject, Observable, debounceTime, distinctUntilChanged, switchMap, of, map, tap } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, Avatar],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class Sidebar implements OnInit, OnDestroy {
  chats$: Observable<any[]>;
  friends$: Observable<any[]>;
  
  activeRoomId: string | null = null;
  activeFriendId: string | null = null;
  
  searchQuery = '';
  searchResults: any[] = [];
  searchHistory: string[] = [];
  showSearchResults = false;
  showHistory = false;
  sentRequests = new Set<string>();
  friendIds = new Set<string>();
  pendingIds = new Set<string>();
  
  @Output() openGroup = new EventEmitter<void>();

  private searchSubject = new Subject<string>();
  private subs = new Subscription();

  constructor(
    public dataService: DataService, 
    private auth: Auth,
    private cdr: ChangeDetectorRef,
    private socketHelper: SocketHelper
  ) {
    // Trier par updatedAt desc (les plus récents en premier)
    this.chats$ = this.dataService.userRooms$.pipe(
      map(rooms => rooms
        .filter(r => r.isPrivate === false)
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      )
    );
    
    this.friends$ = this.dataService.userFriends$.pipe(
      map(data => {
        const myId = this.auth.getUser()?._id;
        return data.map((f: any) => {
          const friend = f.requester?._id === myId ? f.recipient : f.requester;
          return { ...friend, status: f.status, lastSeen: f.lastSeen };
        });
      })
    );
  }

  ngOnInit() {
    this.dataService.fetchRooms();
    this.dataService.fetchFriends();

    this.subs.add(
      this.dataService.activeRoom$.subscribe(room => {
        this.activeRoomId = room ? (room._id || room.id) : null;
        if (room) this.activeFriendId = null;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.dataService.activeFriend$.subscribe(friend => {
        this.activeFriendId = friend ? (friend._id || friend.id) : null;
        if (friend) this.activeRoomId = null;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length > 1) {
            return this.dataService.searchUsers(q).pipe(
              tap(() => this.showHistory = false)
            );
          } else {
            return of([]);
          }
        })
      ).subscribe(res => {
        this.searchResults = res;
        this.showSearchResults = res.length > 0;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.dataService.userFriends$.subscribe(friends => {
        const myId = this.auth.getUser()?._id;
        this.friendIds = new Set(friends.map(f => {
          const friend = f.requester?._id === myId ? f.recipient : f.requester;
          return friend?._id;
        }));
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.dataService.pendingFriends$.subscribe(pending => {
        const myId = this.auth.getUser()?._id;
        this.pendingIds = new Set(pending.map(p => {
          const friend = p.requester?._id === myId ? p.recipient : p.requester;
          return friend?._id;
        }));
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.dataService.fetchPendingFriends()
    );

    this.subs.add(
      this.socketHelper.friendAccepted$.subscribe(() => {
        this.dataService.fetchFriends();
        this.dataService.fetchRooms();
      })
    );

    // Forcer le rafraîchissement de la sidebar quand une room est mise à jour
    this.subs.add(
      this.socketHelper.roomUpdated$.subscribe(() => {
        this.cdr.detectChanges();
      })
    );

    this.dataService.fetchPendingFriends();
    this.loadHistory();

  }

  loadHistory() {
    const userId = this.auth.getUser()?._id;
    const history = localStorage.getItem(`search_history_${userId}`);
    this.searchHistory = history ? JSON.parse(history) : [];
  }

  saveToHistory(query: string) {
    if (!query || query.trim().length < 2) return;
    const q = query.trim();
    const userId = this.auth.getUser()?._id;
    this.searchHistory = [q, ...this.searchHistory.filter(h => h !== q)].slice(0, 5);
    localStorage.setItem(`search_history_${userId}`, JSON.stringify(this.searchHistory));
  }

  removeFromHistory(query: string, event: Event) {
    event.stopPropagation();
    const userId = this.auth.getUser()?._id;
    this.searchHistory = this.searchHistory.filter(h => h !== query);
    localStorage.setItem(`search_history_${userId}`, JSON.stringify(this.searchHistory));
  }

  useHistory(query: string) {
    this.searchQuery = query;
    this.onSearchChange();
    this.showHistory = false;
  }

  getUserStatus(userId: string): 'friend' | 'pending' | 'none' {
    if (this.friendIds.has(userId)) return 'friend';
    if (this.pendingIds.has(userId) || this.sentRequests.has(userId)) return 'pending';
    return 'none';
  }

  isRequestSent(userId: string): boolean {
    return this.sentRequests.has(userId);
  }

  addFriend(userId: string) {
    this.saveToHistory(this.searchQuery);
    this.dataService.sendFriendRequest(userId).subscribe({
      next: () => {
        this.sentRequests.add(userId);
        this.searchQuery = '';
        this.showSearchResults = false;
        this.cdr.markForCheck();
      }
    });
  }

  onGroupCreated(room: any) {
    this.dataService.fetchRooms();
    this.dataService.setActiveRoom(room);
  }

  openCreateGroup() {
    this.openGroup.emit();
  }

  onSearchChange() { this.searchSubject.next(this.searchQuery); }
  selectRoom(room: any) { this.dataService.setActiveRoom(room); }
  selectFriend(friend: any) { this.dataService.setActiveFriend(friend); }
  
  ngOnDestroy() { 
    this.subs.unsubscribe(); 
  }

  onSearchItemClick(user: any) {
    if (this.getUserStatus(user._id) === 'friend') {
      this.useHistory(user.name);
      this.selectFriend(user);
    }
  }

  clearSearch() { 
    this.searchQuery = ''; 
    this.searchResults = []; 
    this.showSearchResults = false;
    this.cdr.markForCheck();
  }
}