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
      errorMsg = `Error: ${error.error.message}`;
    } else {
      errorMsg = error.error?.message || 
                error.error?.error || 
                `Error Code: ${error.status}, Message: ${error.message}`;
    }
    
    return throwError(() => new Error(errorMsg));
  }
}