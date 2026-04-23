import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketHelper } from './services/socket-helper';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private lastActivity = 0;

  constructor(private socketHelper: SocketHelper) {}

  @HostListener('window:mousemove')
  @HostListener('window:keydown')
  @HostListener('window:click')
  onUserActivity() {
    const now = Date.now();
    // On throttle à 30 secondes pour ne pas inonder le serveur
    if (now - this.lastActivity > 30000) {
      this.lastActivity = now;
      this.socketHelper.updateUserActivity();
    }
  }
}
