// teletravail.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface TeletravailForm {
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeletravailService {
  private apiUrl = 'http://localhost:7001/api/teletravail';
  
  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // Assuming token is stored after login
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  submitRequest(formData: TeletravailForm): Observable<any> {
    return this.http.post(this.apiUrl, formData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getCountries(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/countries`)
      .pipe(catchError(this.handleError));
  }

  getRegions(countryName: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/regions/${countryName}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error);
    return throwError(() => new Error(error.message || 'Server error'));
  }
}