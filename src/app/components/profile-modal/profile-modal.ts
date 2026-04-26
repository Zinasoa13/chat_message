import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { Auth } from '../../services/auth';
import { Subscription } from 'rxjs';
import { API_URL } from '../../utils/config';

@Component({
  selector: 'app-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-modal.html',
  styleUrls: ['./profile-modal.css']
})
export class ProfileModal implements OnInit, OnDestroy {
  @Input() user: any;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  activeTab = 'info';
  private subs = new Subscription();

  constructor(private dataService: DataService, private auth: Auth) {}

  ngOnInit() {
    this.subs.add(
      this.auth.currentUser$.subscribe(u => {
        if (u) {
          this.user = u;
        }
      })
    );
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  closeModal() {
    this.close.emit();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.dataService.updateProfilePicture(file).subscribe({
        next: (updatedUser: any) => {
          this.user = updatedUser;
          this.auth.updateLocalUser(updatedUser);
        },
        error: (err: any) => console.error("Erreur upload photo:", err)
      });
    }
  }

  getPhotoUrl(): string {
    if (!this.user?.picture) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    if (this.user.picture.startsWith('http')) return this.user.picture;
    return API_URL + this.user.picture;
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
