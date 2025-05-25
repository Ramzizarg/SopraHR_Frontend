import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private userServiceUrl = 'http://localhost:9001/api/users';

  constructor(private http: HttpClient) {}

  uploadProfilePhoto(userId: number, file: File): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    
    // Important: Don't set Content-Type header when sending FormData
    // The browser will automatically set the correct Content-Type with boundary parameter
    return this.http.post(
      `${this.userServiceUrl}/${userId}/profile-photo`, 
      formData, 
      { withCredentials: true }
    );
  }

  getUserProfilePhoto(userId: number): Observable<any> {
    return this.http.get(`${this.userServiceUrl}/${userId}/profile-photo`, { withCredentials: true });
  }
}
