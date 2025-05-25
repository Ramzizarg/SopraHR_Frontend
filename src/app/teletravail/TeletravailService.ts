import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export enum TeletravailStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface TeletravailForm {
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
  status?: TeletravailStatus;
  rejectionReason?: string;
}

export interface TeletravailResponse {
  id: number;
  userId: number;
  userName?: string;
  teamId?: number;
  teamName?: string;
  teamLeaderId?: number;
  teamLeaderName?: string;
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
  status: TeletravailStatus;
  rejectionReason?: string;
  statusUpdatedAt?: string;
  createdAt?: string;
  message?: string;
  errorMessage?: string;
}

export interface StatusUpdateRequest {
  status: TeletravailStatus;
  rejectionReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeletravailService {
  private apiUrl = 'http://localhost:7001/api/teletravail';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getCountries(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/countries`);
  }

  getRegions(country: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/regions/${country}`);
  }

  submitRequest(form: TeletravailForm): Observable<TeletravailResponse> {
    return this.http.post<TeletravailResponse>(this.apiUrl, form, { headers: this.getHeaders() });
  }

  // Get current user's teletravail requests
  getUserRequests(): Observable<TeletravailResponse[]> {
    return this.http.get<TeletravailResponse[]>(this.apiUrl, { headers: this.getHeaders() });
  }
  
  // Get all teletravail requests - for managers only
  getAllRequests(): Observable<TeletravailResponse[]> {
    return this.http.get<TeletravailResponse[]>(`${this.apiUrl}/all`, { headers: this.getHeaders() });
  }
  
  // Get team teletravail requests - for team leaders only
  getTeamRequests(): Observable<TeletravailResponse[]> {
    return this.http.get<TeletravailResponse[]>(`${this.apiUrl}/team`, { headers: this.getHeaders() });
  }
  
  // Update teletravail request status - for team leaders and managers
  updateRequestStatus(requestId: number, update: StatusUpdateRequest): Observable<TeletravailResponse> {
    return this.http.put<TeletravailResponse>(
      `${this.apiUrl}/${requestId}/status`, 
      update, 
      { headers: this.getHeaders() }
    );
  }
}