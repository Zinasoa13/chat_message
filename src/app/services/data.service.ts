import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { SocketHelper } from './socket-helper';
import { Auth } from './auth';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly baseUrl = 'http://localhost:3000';

  private viewSubject = new BehaviorSubject<string>('home');
  public view$ = this.viewSubject.asObservable();

  public activeRoomSubject = new BehaviorSubject<any>(null);
  public activeRoom$ = this.activeRoomSubject.asObservable();

  public activeFriendSubject = new BehaviorSubject<any>(null);
  public activeFriend$ = this.activeFriendSubject.asObservable();

  private userRoomsSubject = new BehaviorSubject<any[]>([]);
  public userRooms$ = this.userRoomsSubject.asObservable();

  private userFriendsSubject = new BehaviorSubject<any[]>([]);
  public userFriends$ = this.userFriendsSubject.asObservable();

  private userNotificationsSubject = new BehaviorSubject<any[]>([]);
  public userNotifications$ = this.userNotificationsSubject.asObservable();

  private pendingFriendsSubject = new BehaviorSubject<any[]>([]);
  public pendingFriends$ = this.pendingFriendsSubject.asObservable();

  // Cache global pour les statuts de tous les utilisateurs connus
  private userStatusesMap = new Map<string, any>();

  constructor(private http: HttpClient, private socketHelper: SocketHelper, private auth: Auth) {
    // Écouter les changements de statut et mettre à jour le cache et les listes
    this.socketHelper.userStatuses$.subscribe((statuses: any[]) => {
      statuses.forEach(s => this.userStatusesMap.set(s.userId, s));
      this.refreshPresenceInLists();
    });

    // Écouter les nouvelles notifications du socket et les ajouter au flux
    this.socketHelper.notifications$.subscribe((newNotifs: any[]) => {
      if (newNotifs.length > 0) {
        const currentNotifs = this.userNotificationsSubject.value;
        const filteredNew = newNotifs.filter(nn => !currentNotifs.some(cn => (cn._id || cn.id) === (nn._id || nn.id)));
        if (filteredNew.length > 0) {
          this.userNotificationsSubject.next([...filteredNew, ...currentNotifs]);
        }
      }
    });

    // Écouter les mises à jour de rooms (lastMessage)
    this.socketHelper.roomUpdated$.subscribe((data: any) => {
      if (!data) return;
      console.log('📡 roomUpdated reçu:', data);
      const currentRooms = this.userRoomsSubject.value;
      console.log('📦 Rooms actuelles:', currentRooms.map(r => ({ id: r._id, name: r.name, lastMessage: r.lastMessage })));
      const updatedRooms = currentRooms.map(room => {
        const roomId = room._id || room.id;
        if (roomId === data.roomId) {
          console.log('✅ Match trouvé pour room:', room.name);
          return { ...room, lastMessage: data.lastMessage, updatedAt: data.updatedAt };
        }
        return room;
      });
      this.userRoomsSubject.next(updatedRooms);
    });

  }


  private refreshPresenceInLists() {
    const myId = this.auth.getUser()?._id;
    if (!myId) return;

    // 1. Mettre à jour les amis
    const currentFriends = this.userFriendsSubject.value;
    if (currentFriends.length > 0) {
      const updatedFriends = currentFriends.map(f => {
        const friend = f.requester?._id === myId ? f.recipient : f.requester;
        const status = this.userStatusesMap.get(friend?._id);
        return status ? { ...f, status: status.status, lastSeen: status.lastSeen } : f;
      });
      this.userFriendsSubject.next(updatedFriends);
    }

    // 2. Mettre à jour les rooms (calcul du statut agrégé pour les groupes)
    const currentRooms = this.userRoomsSubject.value;
    if (currentRooms.length > 0) {
      const updatedRooms = currentRooms.map(room => {
        if (!room.isPrivate) {
          // Pour un groupe, on calcule le statut agrégé (incluant soi-même)
          const members = room.members || [];
          
          let roomStatus = 'offline';
          const memberStatuses = members.map((m: any) => {
            const mId = m._id || m;
            // Si c'est moi, je suis forcément online (ou idle, mais on simplifie ici à online pour l'instant comme demandé)
            if (mId === myId) return 'online'; 
            return this.userStatusesMap.get(mId)?.status || 'offline';
          });

          if (memberStatuses.includes('online')) {
            roomStatus = 'online';
          } else if (memberStatuses.includes('idle')) {
            roomStatus = 'idle';
          }

          return { ...room, status: roomStatus };
        }
        return room;
      });
      this.userRoomsSubject.next(updatedRooms);
    }
  }

  public getStatus(userId: string) {
    return this.userStatusesMap.get(userId);
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
      next: fetchedRooms => {
        const currentRooms = this.userRoomsSubject.value;
        const merged = fetchedRooms.map((fetched: any) => {
          const current = currentRooms.find((r: any) => (r._id || r.id) === (fetched._id || fetched.id));
          // Conserver la version en mémoire si elle est plus récente (évite d'écraser un event socket avec une vieille requête HTTP)
          if (current && new Date(current.updatedAt || 0) > new Date(fetched.updatedAt || 0)) {
            return current;
          }
          if (current && current.status) {
            return { ...fetched, status: current.status };
          }
          return fetched;
        });

        // Ajouter les rooms créées localement qui ne sont pas encore dans le retour HTTP
        currentRooms.forEach((cr: any) => {
          if (!merged.find((m: any) => (m._id || m.id) === (cr._id || cr.id))) {
            merged.push(cr);
          }
        });

        this.userRoomsSubject.next(merged);
        this.refreshPresenceInLists();
      },
      error: () => this.userRoomsSubject.next([])
    });
  }

  public createRoom(name: string) { return this.http.post(`${this.baseUrl}/rooms`, { name }); }
  public joinRoom(roomCode: string) { return this.http.post(`${this.baseUrl}/rooms/join/${roomCode}`, {}); }

  // --- FRIENDS ---
  public getFriends(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/friends`); }
  public fetchFriends() {
    this.getFriends().subscribe({
      next: friends => {
        const myId = this.auth.getUser()?._id;
        const merged = friends.map(f => {
          const friend = f.requester?._id === myId ? f.recipient : f.requester;
          const status = this.userStatusesMap.get(friend?._id);
          return status ? { ...f, status: status.status, lastSeen: status.lastSeen } : f;
        });
        this.userFriendsSubject.next(merged);
      },
      error: () => this.userFriendsSubject.next([])
    });
  }
  public getPendingFriends(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/friends/pending`); }
  public fetchPendingFriends() {
    this.getPendingFriends().subscribe({
      next: pending => this.pendingFriendsSubject.next(pending),
      error: () => this.pendingFriendsSubject.next([])
    });
  }
  public sendFriendRequest(userId: string) { 
    return this.http.post(`${this.baseUrl}/friends/request/${userId}`, {}).pipe(
      tap(() => this.fetchPendingFriends())
    ); 
  }
  public acceptFriendRequest(requestId: string) { 
    return this.http.patch(`${this.baseUrl}/friends/accept/${requestId}`, {}).pipe(
      tap(() => {
        this.fetchPendingFriends();
        this.fetchFriends();
      })
    ); 
  }
  public searchUsers(query: string): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/users/search?q=${encodeURIComponent(query)}`); }

  // --- NOTIFICATIONS ---
  public getNotifications(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/notifications`); }
  public fetchNotifications() {
    this.getNotifications().subscribe({
      next: notifs => this.userNotificationsSubject.next(notifs),
      error: () => this.userNotificationsSubject.next([])
    });
  }
  public markNotificationsAsRead() {
    return this.http.patch(`${this.baseUrl}/notifications/mark-as-read`, {});
  }

  // --- NOTES ---
  public getNotes(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/notes`); }
  public createNote(content: string, title: string) { return this.http.post(`${this.baseUrl}/notes`, { title, content }); }
  public deleteNote(id: string) { return this.http.delete(`${this.baseUrl}/notes/${id}`); }

  // --- USER PROFILE ---
  public uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/chat/upload`, formData);
  }

  public updateProfilePicture(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.patch(`${this.baseUrl}/users/me/profile-picture`, formData);
  }
}