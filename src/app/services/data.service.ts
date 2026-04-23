import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { SocketHelper } from './socket-helper';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly baseUrl = 'http://localhost:3000';

  private viewSubject = new BehaviorSubject<string>('home');
  public view$ = this.viewSubject.asObservable();

  private activeRoomSubject = new BehaviorSubject<any>(null);
  public activeRoom$ = this.activeRoomSubject.asObservable();

  private activeFriendSubject = new BehaviorSubject<any>(null);
  public activeFriend$ = this.activeFriendSubject.asObservable();

  private userRoomsSubject = new BehaviorSubject<any[]>([]);
  public userRooms$ = this.userRoomsSubject.asObservable();

  private userFriendsSubject = new BehaviorSubject<any[]>([]);
  public userFriends$ = this.userFriendsSubject.asObservable();

  private userNotificationsSubject = new BehaviorSubject<any[]>([]);
  public userNotifications$ = this.userNotificationsSubject.asObservable();

  constructor(private http: HttpClient, private socketHelper: SocketHelper) {
    // Écouter les nouvelles notifications du socket et les ajouter au flux
    this.socketHelper.notifications$.subscribe((newNotifs: any[]) => {
      if (newNotifs.length > 0) {
        const currentNotifs = this.userNotificationsSubject.value;
        // On évite les doublons en vérifiant l'ID
        const filteredNew = newNotifs.filter(nn => !currentNotifs.some(cn => (cn._id || cn.id) === (nn._id || nn.id)));
        if (filteredNew.length > 0) {
          this.userNotificationsSubject.next([...filteredNew, ...currentNotifs]);
        }
      }
    });
  }

  // --- NAVIGATION ---
  public setView(view: string) { this.viewSubject.next(view); }
  public setActiveRoom(room: any) {
    this.activeFriendSubject.next(null);
    this.activeRoomSubject.next(room);
    this.setView('home');
  }
  public setActiveFriend(friend: any) {
    this.activeRoomSubject.next(null);
    this.activeFriendSubject.next(friend);
    this.setView('home');
  }

  // --- ROOMS ---
  public getRooms(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/rooms`); }
  public fetchRooms() {
    this.getRooms().subscribe({
      next: rooms => this.userRoomsSubject.next(rooms),
      error: () => this.userRoomsSubject.next([])
    });
  }
  public createRoom(name: string) { return this.http.post(`${this.baseUrl}/rooms`, { name }); }
  public joinRoom(roomCode: string) { return this.http.post(`${this.baseUrl}/rooms/join/${roomCode}`, {}); }

  // --- FRIENDS ---
  public getFriends(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/friends`); }
  public fetchFriends() {
    this.getFriends().subscribe({
      next: friends => this.userFriendsSubject.next(friends),
      error: () => this.userFriendsSubject.next([])
    });
  }
  public getPendingFriends(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/friends/pending`); }
  public sendFriendRequest(userId: string) { return this.http.post(`${this.baseUrl}/friends/request/${userId}`, {}); }
  public acceptFriendRequest(requestId: string) { return this.http.patch(`${this.baseUrl}/friends/accept/${requestId}`, {}); }
  public searchUsers(query: string): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/users/search?q=${encodeURIComponent(query)}`); }

  // --- NOTIFICATIONS ---
  public getNotifications(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/notifications`); }
  public fetchNotifications() {
    this.getNotifications().subscribe({
      next: notifs => this.userNotificationsSubject.next(notifs),
      error: () => this.userNotificationsSubject.next([])
    });
  }

  // --- NOTES ---
  public getNotes(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/notes`); }
  public createNote(content: string, title: string) { return this.http.post(`${this.baseUrl}/notes`, { title, content }); }
  public deleteNote(id: string) { return this.http.delete(`${this.baseUrl}/notes/${id}`); }

  // --- USER PROFILE ---
  public updateProfilePicture(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.patch(`${this.baseUrl}/users/me/profile-picture`, formData);
  }
}