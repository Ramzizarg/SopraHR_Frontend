// auth.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './AuthService';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private authService: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Check if authentication token exists and is valid
    const token = this.authService.getToken();
    console.log('AuthGuard checking authentication for route:', state.url);
    console.log('Token exists:', !!token);
    
    if (this.authService.isLoggedIn()) {
      // Check if route requires manager role
      const requiresManager = route.data && route.data['requiresManager'] === true;
      
      if (requiresManager && !this.authService.isManager()) {
        console.log('Route requires manager role but user is not a manager');
        this.router.navigate(['/home']);
        return false;
      }
      
      return true;
    }
    
    // Store the attempted URL for redirecting after login
    console.log('User not authenticated, redirecting to login');
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
    return false;
  }
}