import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon-btn',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="icon-button" [class.dark]="theme === 'dark'" [class.active]="active">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .icon-button {
      background: transparent;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 10px;
      border-radius: 12px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-button:hover {
      background: rgba(0,0,0,0.05);
      color: #000;
    }
    .icon-button.dark.active {
      background: #000;
      color: #fff;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    }
    ::ng-content svg { width: 20px; height: 20px; }
  `]
})
export class IconBtn {
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() active: boolean = false;
}
