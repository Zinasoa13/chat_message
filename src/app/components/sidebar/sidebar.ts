import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Avatar } from '../../utils/avatar/avatar';
import { CreateGroupModal } from '../create-group-modal/create-group-modal';
import { DataService } from '../../services/data.service';
import { Auth } from '../../services/auth';
import { Subscription, Subject, Observable, debounceTime, distinctUntilChanged, switchMap, of, map, tap } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, Avatar, CreateGroupModal],
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
  showSearchResults = false;
  sentRequests = new Set<string>();
  createGroupOpen = false;

  private searchSubject = new Subject<string>();
  private subs = new Subscription();

  constructor(
    public dataService: DataService, 
    private auth: Auth,
    private cdr: ChangeDetectorRef
  ) {
    // Filtrer pour ne garder que les groupes (isPrivate = false ou undefined)
    this.chats$ = this.dataService.userRooms$.pipe(
      map(rooms => rooms.filter(r => r.isPrivate === false))
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
        switchMap(q => q.length > 1 ? this.dataService.searchUsers(q) : of([]))
      ).subscribe(res => {
        this.searchResults = res;
        this.showSearchResults = res.length > 0;
        this.cdr.markForCheck();
      })
    );
  }

  isRequestSent(userId: string): boolean {
    return this.sentRequests.has(userId);
  }

  addFriend(userId: string) {
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
    this.createGroupOpen = true;
    this.cdr.markForCheck();
  }

  onSearchChange() { this.searchSubject.next(this.searchQuery); }
  selectRoom(room: any) { this.dataService.setActiveRoom(room); }
  selectFriend(friend: any) { this.dataService.setActiveFriend(friend); }
  
  ngOnDestroy() { 
    this.subs.unsubscribe(); 
  }

  clearSearch() { 
    this.searchQuery = ''; 
    this.searchResults = []; 
    this.showSearchResults = false;
    this.cdr.markForCheck();
  }
}