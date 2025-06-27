import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../login/AuthService';

export interface TeletravailRequest {
  id: number;
  userId: number;
  userName: string;
  teletravailDate: string;
  status: string;
  team: string;
  teamLeaderId: number;
  teamLeaderName: string;
  travailType: string;
  rejectionReason?: string;
  profilePhotoUrl?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeletravailbackService {
  private apiUrl = 'http://localhost:7001/api/teletravail';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getAllRequests(): Observable<TeletravailRequest[]> {
    return this.http.get<TeletravailRequest[]>(`${this.apiUrl}/all`, {
      headers: this.getHeaders()
    });
  }

  updateRequestStatus(requestId: number, status: string, rejectionReason?: string): Observable<TeletravailRequest> {
    return this.http.put<TeletravailRequest>(`${this.apiUrl}/${requestId}/status`, {
      status,
      rejectionReason
    }, {
      headers: this.getHeaders()
    });
  }

  deleteRequest(requestId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${requestId}`, {
      headers: this.getHeaders()
    });
  }
} 