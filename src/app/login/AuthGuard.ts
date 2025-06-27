// auth.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './AuthService';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private authService: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    console.log('AuthGuard checking authentication for route:', state.url);
    
    // Check if user is already logged in
    if (!this.authService.isLoggedIn()) {
      // Store the attempted URL for redirecting after login
      console.log('User not authenticated, redirecting to login');
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
      return false;
    }
    
    // Make sure the user profile is fully loaded before making authorization decisions
    return this.authService.ensureProfileLoaded().pipe(
      map(user => {
        console.log('Full user profile loaded:', user);
        console.log('User role:', user?.role);
        console.log('Normalized role:', user?.normalizedRole);
        
        // ADMIN USERS HAVE FULL ACCESS TO EVERYTHING
        if (this.authService.isAdmin()) {
          console.log('✓ User is ADMIN - granting FULL ACCESS to', state.url);
          return true;
        }
        
        console.log('User is not admin, checking specific route requirements');
        
        // Check route requirements
        const requiresAdmin = route.data && route.data['requiresAdmin'] === true;
        const requiresManager = route.data && route.data['requiresManager'] === true;
        const requiresManagerOrTeamLeader = route.data && route.data['requiresManagerOrTeamLeader'] === true;
        
        console.log('Route requires admin:', requiresAdmin);
        console.log('Route requires manager:', requiresManager);
        console.log('Route requires manager or team leader:', requiresManagerOrTeamLeader);
        
        // Handle admin-only routes
        if (requiresAdmin) {
          console.log('✗ Route requires ADMIN role');
          this.router.navigate(['/home']);
          return false;
        }
        
        // Handle manager-only routes
        if (requiresManager && !this.authService.isManager()) {
          console.log('✗ Route requires MANAGER role');
          this.router.navigate(['/home']);
          return false;
        }

        // Handle manager or team leader routes
        if (requiresManagerOrTeamLeader && !this.authService.isManager() && !this.authService.isTeamLeader()) {
          console.log('✗ Route requires MANAGER or TEAM_LEADER role');
          this.router.navigate(['/home']);
          return false;
        }
        
        // User has appropriate permissions
        console.log('✓ User has appropriate permissions for', state.url);
        return true;
      }),
      catchError(error => {
        console.error('Error in AuthGuard:', error);
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
