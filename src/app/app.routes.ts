import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Chat } from './pages/chat/chat';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'chat', component: Chat, canActivate: [authGuard] }
];