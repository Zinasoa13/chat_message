import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { SocketHelper } from '../../services/socket-helper';
import { Auth } from '../../services/auth';
import { Avatar } from '../../utils/avatar/avatar';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-create-group-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, Avatar],
  templateUrl: './create-group-modal.html',
  styleUrls: ['./create-group-modal.css']
})
export class CreateGroupModal implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<any>();

  groupName = '';
  searchQuery = '';
  friends$: Observable<any[]>;
  selectedFriends = new Set<string>();

  constructor(
    private dataService: DataService, 
    private socketHelper: SocketHelper,
    private auth: Auth
  ) {
    this.friends$ = this.dataService.userFriends$.pipe(
      map(friends => {
        const myId = this.auth.getUser()?._id;
        return friends.map(f => f.requester?._id === myId ? f.recipient : f.requester);
      })
    );
  }

  ngOnInit() {
    // Ideally we should ensure friends are loaded
    this.dataService.fetchFriends();
  }

  toggleFriend(friendId: string) {
    if (this.selectedFriends.has(friendId)) {
      this.selectedFriends.delete(friendId);
    } else {
      this.selectedFriends.add(friendId);
    }
  }

  getFilteredFriends(friends: any[]) {
    if (!this.searchQuery.trim()) return friends;
    const q = this.searchQuery.toLowerCase();
    return friends.filter(f => f.name?.toLowerCase().includes(q));
  }

  createGroup() {
    if (!this.groupName.trim()) return;

    this.dataService.createRoom(this.groupName).subscribe({
      next: (room: any) => {
        // room object should contain name, roomCode, _id
        const roomData = room.room || room; 
        
        // Invite selected friends
        this.selectedFriends.forEach(friendId => {
          this.socketHelper.inviteToRoom(friendId, roomData.roomCode, roomData.name);
        });

        this.created.emit(roomData);
        this.closeModal();
      },
      error: (err) => console.error('Error creating room:', err)
    });
  }

  closeModal() {
    this.groupName = '';
    this.selectedFriends.clear();
    this.searchQuery = '';
    this.close.emit();
  }
}
