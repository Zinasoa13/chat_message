import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { API_URL } from '../config';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar-box" [style.width.px]="size" [style.height.px]="size" [style.border-radius.px]="radius">
      <!-- On utilise la fonction getFullUrl() pour l'image -->
      <img *ngIf="src" [src]="getFullUrl(src)" [alt]="name" (error)="onImgError()">

      <!-- Si pas d'image ou si l'image plante, on affiche les initiales -->
      <span *ngIf="!src || imgFailed">{{ getInitials(name) }}</span>

      <div *ngIf="status" class="status-indicator" [class]="status"></div>
    </div>
  `,
  styles: [`
    .avatar-box {
      background: var(--secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      position: relative;
      color: var(--text-secondary);
      overflow: hidden;
      user-select: none;
    }
    img { width: 100%; height: 100%; object-fit: cover; }
    .status-indicator {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 25%;
      height: 25%;
      border-radius: 50%;
      border: 2px solid var(--card);
      z-index: 10;
    }
    .online { background: #10b981; }
    .idle { background: #f59e0b; }
    .offline { background: #94a3b8; }
  `]
})
export class Avatar {
  @Input() src?: string;
  @Input() name: string = 'User';
  @Input() size: number = 48;
  @Input() radius: number = 16;
  @Input() status?: string;

  imgFailed = false;

  // Transforme l'URL du back en URL utilisable par le navigateur
  getFullUrl(path: string): string {
    if (!path) return '';
    // Si c'est déjà une URL complète (Google par exemple), on ne touche à rien
    if (path.startsWith('http')) return path;
    // Sinon, on ajoute l'adresse de ton serveur NestJS
    return `${API_URL}${path}`;
  }

  // Si l'image ne charge pas (URL cassée), on bascule sur les initiales
  onImgError() {
    this.imgFailed = true;
  }

  // Génère des initiales propres (ex: "Sushi Baka" -> "SB")
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}