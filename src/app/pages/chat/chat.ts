import { Component, OnInit } from '@angular/core';
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
import { DataService } from '../../services/data.service'; // Assure-toi de l'import

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, Navbar, Sidebar, ChatArea, BotModal, ProfileModal, NoteList, RoomList, Calendar],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css']
})
export class Chat implements OnInit {
  userName: string = '';
  userPhoto: string = '';
  currentView: string = 'home'; // On précise le type string
  botOpen = false;
  profileOpen = false;
  user: any = null;

  constructor(
    private auth: Auth,
    private router: Router,
    private socket: SocketHelper,
    public dataService: DataService // Assure-toi qu'il est bien en 'public'
  ) {}

  ngOnInit() {
    // Vérifier si on est connecté
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // RÉSOLUTION DE L'ERREUR ICI :
    // On ajoute le type (view: string)
    // RÉSOLUTION DE L'ERREUR ICI :
	  // On ajoute le type (view: string)
	(this.dataService as any).view$.subscribe((view: string) => {
	this.currentView = view;
	});

    this.auth.currentUser$.subscribe(user => {
      this.user = user;
      this.userName = this.user?.name || 'Utilisateur';

      const picture = this.user?.picture;
      if (picture) {
        this.userPhoto = picture.startsWith('http') ? picture : 'http://localhost:3000' + picture;
      } else {
        this.userPhoto = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
      }
    });

    this.socket.connect();
  }
}