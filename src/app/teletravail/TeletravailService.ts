import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeletravailForm {
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
}

export interface TeletravailResponse {
  id: number;
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
  message?: string;
  errorMessage?: string;
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

  getUserRequests(): Observable<TeletravailResponse[]> {
    return this.http.get<TeletravailResponse[]>(this.apiUrl, { headers: this.getHeaders() });
  }
}