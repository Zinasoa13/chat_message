import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-room-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="view-container">
      <div class="view-header">
        <span class="material-icons-rounded">groups</span>
        <h2>Rooms & Groupes</h2>
      </div>

      <div class="rooms-grid custom-scrollbar">
        <div class="room-card" *ngFor="let room of rooms">
          <div class="room-icon">
            <span class="material-icons-rounded">chat_bubble</span>
          </div>
          <div class="room-details">
            <h3>{{room.name}}</h3>
            <p>{{room.members?.length || 0}} membres</p>
          </div>
          <button class="join-btn" (click)="openRoom(room)">
            <span class="material-icons-rounded">login</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-container { padding: 2rem; height: 100%; display: flex; flex-direction: column; }
    .view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
    .view-header h2 { font-weight: 800; font-size: 1.5rem; color: #1f2937; }
    .rooms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .room-card { background: white; padding: 1.5rem; border-radius: 24px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .room-icon { width: 50px; height: 50px; background: #eff6ff; color: #3b82f6; border-radius: 15px; display: flex; align-items: center; justify-content: center; }
    .room-details { flex: 1; }
    .room-details h3 { margin: 0; font-size: 1rem; }
    .room-details p { margin: 0; font-size: 0.8rem; color: #6b7280; }
    .join-btn { border: none; background: #3b82f6; color: white; padding: 10px; border-radius: 12px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
    .join-btn:hover { transform: scale(1.1); background: #2563eb; }
  `]
})
export class RoomList implements OnInit {
  rooms: any[] = [];

  constructor(private dataService: DataService, private router: Router) {}

  ngOnInit() {
    // CORRECTION DES ERREURS DE TYPE ICI :
    this.dataService.getRooms().subscribe({
      next: (data: any[]) => { // On précise que c'est un tableau
        this.rooms = data;
      },
      error: (err: any) => { // On précise le type d'erreur
        console.error('Erreur chargement rooms', err);
      }
    });
  }

  openRoom(room: any) {
    // Cette méthode dans le service change la vue en 'home' automatiquement
    this.dataService.setActiveRoom(room);
  }
}