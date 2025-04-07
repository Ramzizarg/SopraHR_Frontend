// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:9000/auth';
  private loggedIn = false;

  constructor(private http: HttpClient) {
    // Check if token exists in localStorage or sessionStorage on initialization
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    this.loggedIn = !!token;
  }

  login(email: string, password: string, rememberMe: boolean): Observable<any> {
    const loginData = { email, password };
    return this.http.post(`${this.apiUrl}/login`, loginData).pipe(
      tap((response: any) => {
        this.loggedIn = true;
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('accessToken', response.accessToken);
        if (response.refreshToken) {
          storage.setItem('refreshToken', response.refreshToken);
        }
        console.log('Login successful, token stored in', rememberMe ? 'localStorage' : 'sessionStorage');
      }),
      catchError(error => {
        this.loggedIn = false;
        console.log('Login failed:', error);
        return throwError(error);
      })
    );
  }

  logout(): void {
    this.loggedIn = false;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    console.log('Logged out');
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    return this.loggedIn && !!token;
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  }
}