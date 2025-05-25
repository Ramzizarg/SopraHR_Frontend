import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PasswordResetService {
  private apiUrl = 'http://localhost:9001';

  constructor(private http: HttpClient) { }

  /**
   * Request a password reset for the current user
   * @param email The user's email address
   * @returns Observable of the response
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/forgot-password`, {
      email: email.trim()
    });
  }
}
