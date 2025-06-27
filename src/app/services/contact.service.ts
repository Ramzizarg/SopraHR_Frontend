import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ContactRequest {
  id?: number;
  priority: string;
  subject: string;
  message: string;
  userEmail: string;
  employeeName?: string;
  createdAt?: Date;
  status?: string;
  response?: string;
  respondedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiUrl = 'http://localhost:4001/api/contact';

  constructor(private http: HttpClient) { }

  createContactRequest(request: ContactRequest): Observable<ContactRequest> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Employee-Name': request.employeeName || ''
    });

    return this.http.post<ContactRequest>(this.apiUrl, request, { headers });
  }

  getContactRequests(): Observable<ContactRequest[]> {
    return this.http.get<ContactRequest[]>(this.apiUrl);
  }

  getContactRequestById(id: number): Observable<ContactRequest> {
    return this.http.get<ContactRequest>(`${this.apiUrl}/${id}`);
  }

  updateContactRequest(id: number, request: ContactRequest): Observable<ContactRequest> {
    return this.http.put<ContactRequest>(`${this.apiUrl}/${id}`, request);
  }

  deleteContactRequest(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  respondToContactRequest(id: number, data: { response: string; status: string }): Observable<ContactRequest> {
    return this.http.post<ContactRequest>(`${this.apiUrl}/${id}/respond`, data);
  }
} 