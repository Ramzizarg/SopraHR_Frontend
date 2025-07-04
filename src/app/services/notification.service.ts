import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'TELEWORK_REQUEST_CREATED' | 'TELEWORK_REQUEST_APPROVED' | 'TELEWORK_REQUEST_REJECTED';
  status: 'UNREAD' | 'READ';
  relatedEntityId?: number;
  relatedEntityType?: string;
  createdAt: string;
  readAt?: string;
}

export interface CreateNotification {
  userId: number;
  title: string;
  message: string;
  type: 'TELEWORK_REQUEST_CREATED' | 'TELEWORK_REQUEST_APPROVED' | 'TELEWORK_REQUEST_REJECTED';
  relatedEntityId?: number;
  relatedEntityType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:3001/api/notifications';

  constructor(private http: HttpClient) { }

  getUserNotifications(userId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/user/${userId}`);
  }

  getUserUnreadNotifications(userId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/user/${userId}/unread`);
  }

  getUnreadNotificationCount(userId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/user/${userId}/unread-count`);
  }

  markAsRead(notificationId: number): Observable<Notification> {
    return this.http.put<Notification>(`${this.apiUrl}/${notificationId}/read`, {});
  }

  markAllAsRead(userId: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/user/${userId}/mark-all-read`, {});
  }

  deleteNotification(notificationId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${notificationId}`);
  }

  getNotificationsByType(userId: number, type: string): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/user/${userId}/type/${type}`);
  }

  createNotification(notification: CreateNotification): Observable<Notification> {
    return this.http.post<Notification>(this.apiUrl, notification);
  }
} 