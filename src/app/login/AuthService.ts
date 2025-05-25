import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface UserProfile {
  id: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  team?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authApiUrl = 'http://localhost:9001';
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  
  constructor(private http: HttpClient) {
    // Check for existing token on startup and load user profile
    const token = this.getToken();
    if (token) {
      this.loadUserProfile().subscribe();
    }
  }

  get currentUser(): Observable<UserProfile | null> {
    return this.currentUserSubject.asObservable();
  }

  get currentUserValue(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string, rememberMe: boolean = true): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/auth/login`, { email, password })
      .pipe(
        tap(response => {
          console.log('Login response:', response);
          // Check different possible token field names
          const token = response.token || response.accessToken;
          
          if (token) {
            console.log('Storing token:', token);
            // Store token in localStorage consistently
            localStorage.setItem('auth_token', token);
            
            // Also store as accessToken for backwards compatibility
            localStorage.setItem('accessToken', token);
            
            // Load user profile info after successful login
            this.loadUserProfile().subscribe(
              profile => console.log('Profile loaded:', profile),
              error => console.error('Profile loading error:', error)
            );
          } else {
            console.error('No token found in response:', response);
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return this.handleError(error);
        })
      );
  }

  getToken(): string | null {
    // Try both possible storage keys
    return localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token;
  }

  isManager(): boolean {
    const user = this.currentUserSubject.value;
    return !!user && (user.role === 'MANAGER' || user.role === 'ROLE_MANAGER');
  }
  
  isTeamLeader(): boolean {
    const user = this.currentUserSubject.value;
    return !!user && (user.role === 'TEAM_LEADER' || user.role === 'ROLE_TEAM_LEADER');
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    if (!user || !user.role) return false;
    
    // Direct match
    if (user.role === role) return true;
    
    // Handle both ROLE_ prefix convention and without prefix
    const normalizedUserRole = user.role.startsWith('ROLE_') ? user.role : `ROLE_${user.role}`;
    const normalizedRequestedRole = role.startsWith('ROLE_') ? role : `ROLE_${role}`;
    
    return normalizedUserRole === normalizedRequestedRole;
  }

  loadUserProfile(): Observable<UserProfile> {
    console.log('Loading user profile with token:', this.getToken());
    return this.http.get<UserProfile>(`${this.authApiUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    }).pipe(
      tap(profile => {
        console.log('User profile loaded:', profile);
        this.currentUserSubject.next(profile);
      }),
      catchError(error => {
        console.error('Profile loading error:', error);
        // If unauthorized, clear token
        if (error.status === 401 || error.status === 403) {
          console.warn('Auth error, logging out');
          this.logout();
        }
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    // Clear both token storage keys
    localStorage.removeItem('auth_token');
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('accessToken');
    this.currentUserSubject.next(null);
  }

  private handleError(error: any) {
    console.error('Auth Error:', error);
    let errorMsg: string;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMsg = `Une erreur s'est produite. Veuillez réessayer.`;
    } else {
      // Server-side error
      // Handle specific error codes with user-friendly messages
      switch (error.status) {
        case 401:
          errorMsg = `Identifiants incorrects. Veuillez vérifier votre email et mot de passe.`;
          break;
        case 403:
          errorMsg = `Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.`;
          break;
        case 404:
          errorMsg = `Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard.`;
          break;
        case 500:
          errorMsg = `Une erreur est survenue sur le serveur. Veuillez réessayer plus tard.`;
          break;
        default:
          // Only use technical details for unexpected errors
          errorMsg = error.error?.message || 
                    error.error?.error || 
                    `Une erreur s'est produite lors de la connexion. Veuillez réessayer.`;
      }
    }
    
    return throwError(() => new Error(errorMsg));
  }
}