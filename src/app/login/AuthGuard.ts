// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './AuthService';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    console.log('AuthGuard: Checking if logged in:', this.authService.isLoggedIn());
    if (this.authService.isLoggedIn()) {
      return true;
    } else {
      console.log('AuthGuard: Not logged in, redirecting to /login');
      this.router.navigate(['/login']);
      return false;
    }
  }
}