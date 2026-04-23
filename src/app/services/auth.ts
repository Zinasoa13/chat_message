import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly TOKEN_KEY = 'soachat_token';
  private readonly USER_KEY = 'soachat_user';
  private isBrowser: boolean;
  
  private userSubject: BehaviorSubject<any | null>;
  public currentUser$: Observable<any | null>;

  constructor(@Inject(PLATFORM_ID) platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Initialiser le stream avec la valeur actuelle du localStorage
    const initialUser = this.getUser();
    this.userSubject = new BehaviorSubject<any | null>(initialUser);
    this.currentUser$ = this.userSubject.asObservable();
  }

  saveSession(token: string, user: any) {
    if (this.isBrowser) {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.userSubject.next(user);
    }
  }

  updateLocalUser(user: any) {
    if (this.isBrowser) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.userSubject.next(user);
    }
  }

  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  getUser(): any | null {
    if (this.isBrowser) {
      const user = localStorage.getItem(this.USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  getCurrentUserValue() {
    return this.userSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      this.userSubject.next(null);
      window.location.href = '/login';
    }
  }
}
