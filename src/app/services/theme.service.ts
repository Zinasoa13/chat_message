import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark-purple' | 'dark-blue';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(this.getInitialTheme());
  theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  private getInitialTheme(): Theme {
    const saved = localStorage.getItem('chat-theme') as Theme;
    return saved || 'light';
  }

  setTheme(theme: Theme) {
    localStorage.setItem('chat-theme', theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  getNextTheme(): Theme {
    const current = this.themeSubject.value;
    if (current === 'light') return 'dark-purple';
    if (current === 'dark-purple') return 'dark-blue';
    return 'light';
  }

  cycleTheme() {
    const next = this.getNextTheme();
    this.setTheme(next);
  }

  private applyTheme(theme: Theme) {
    if (theme === 'light') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', theme);
    }
  }

  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }
}
