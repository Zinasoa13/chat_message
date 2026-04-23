import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  constructor(
    private auth: Auth,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    console.log("LoginComponent initialized");
    
    // 1. Vérifier si on est déjà connecté
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/chat']);
      return;
    }

    // 2. Extraire le token et l'user de l'URL
    this.route.queryParams.subscribe(params => {
      console.log("Query params received:", params);
      const token = params['token'];
      const userStr = params['user'];

      if (token && userStr) {
        try {
          console.log("Token and user found, saving session...");
          const user = JSON.parse(userStr);
          this.auth.saveSession(token, user);
          
          console.log("Session saved, redirecting to chat...");
          // Utiliser setTimeout pour s'assurer que le cycle Angular est prêt
          setTimeout(() => {
            this.router.navigate(['/chat']);
          }, 100);
        } catch (e) {
          console.error("Erreur parsing user", e);
        }
      } else {
        console.log("No token or user in query params");
      }
    });
  }

  loginWithGoogle() {
    window.location.href = 'http://localhost:3000/auth/google';
  }
}