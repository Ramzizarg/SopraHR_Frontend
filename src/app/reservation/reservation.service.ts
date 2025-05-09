import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../login/AuthService';

export interface Reservation {
  id?: number;
  deskId: number;
  bookingDate: string;
  duration: string;
  employeeName?: string; // Will be set automatically on the server from the user profile
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Desk {
  id: number;
  left: number;
  top: number;
  rotation: number;
  available?: boolean;
  planId?: number;
}

export interface Wall {
  id?: number;
  wallId?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  planId?: number;
}

export interface Plan {
  id?: number;
  name: string;
  width: number;
  height: number;
  left?: number;
  top?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = 'http://localhost:6001/api/v1';
  
  constructor(private http: HttpClient, private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    // Get token from AuthService
    const token = this.authService.getToken();
    
    console.log('Using token for API request:', token ? 'Token exists' : 'No token found');
    
    if (!token) {
      console.warn('No authentication token available. User may need to login again.');
    }
    
    // Create headers with token
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    
    return headers;
  }

  // Plan API methods
  getPlans(): Observable<Plan[]> {
    console.log('Fetching plans from:', `${this.apiUrl}/plans`);
    console.log('With auth token:', this.authService.getToken() ? 'Present' : 'Missing');
    
    // For debugging - check if user is logged in and has manager role
    console.log('User logged in:', this.authService.isLoggedIn());
    console.log('User is manager:', this.authService.isManager());
    
    return this.http.get<Plan[]>(`${this.apiUrl}/plans`, { 
      headers: this.getHeaders(),
      observe: 'response'
    })
    .pipe(
      map(response => {
        console.log('Plans API response status:', response.status);
        console.log('Plans API response headers:', response.headers.keys());
        return response.body || [];
      }),
      catchError(error => {
        console.error('Plans API error details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          headers: error.headers ? Array.from(error.headers.keys()).map(key => `${key}: ${error.headers.get(key)}`) : 'No headers',
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  createPlan(plan: Plan): Observable<Plan> {
    return this.http.post<Plan>(`${this.apiUrl}/plans`, plan, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePlan(planId: number, plan: Plan): Observable<Plan> {
    console.log(`Updating plan ${planId} with dimensions:`, { width: plan.width, height: plan.height });
    return this.http.put<Plan>(`${this.apiUrl}/plans/${planId}`, plan, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePlan(planId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/plans/${planId}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Desk API methods
  getDesksByPlanId(planId: number): Observable<Desk[]> {
    return this.http.get<Desk[]>(`${this.apiUrl}/desks/plan/${planId}`, { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  getAvailableDesks(planId: number, date: string): Observable<Desk[]> {
    return this.http.get<Desk[]>(`${this.apiUrl}/desks/available?planId=${planId}&date=${date}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  createDesk(planId: number, desk: Desk): Observable<Desk> {
    return this.http.post<Desk>(`${this.apiUrl}/desks/plan/${planId}`, desk, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  updateDesk(deskId: number, desk: Desk): Observable<Desk> {
    return this.http.put<Desk>(`${this.apiUrl}/desks/${deskId}`, desk, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteDesk(deskId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/desks/${deskId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Wall API methods
  getWallsByPlanId(planId: number): Observable<Wall[]> {
    return this.http.get<Wall[]>(`${this.apiUrl}/walls/plan/${planId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  createWall(planId: number, wall: Wall): Observable<Wall> {
    return this.http.post<Wall>(`${this.apiUrl}/walls/plan/${planId}`, wall, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  updateWall(wallId: number, wall: Wall): Observable<Wall> {
    return this.http.put<Wall>(`${this.apiUrl}/walls/${wallId}`, wall, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteWall(wallId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/walls/${wallId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Reservation API methods
  getUserReservations(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations/user`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  getReservationsByDate(date: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations/date?date=${date}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserReservationsInDateRange(startDate: string, endDate: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(
      `${this.apiUrl}/reservations/user/daterange?startDate=${startDate}&endDate=${endDate}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  createReservation(reservation: Reservation): Observable<Reservation> {
    // Add debug logging for the reservation request
    console.log('Creating reservation:', {
      deskId: reservation.deskId,
      bookingDate: reservation.bookingDate,
      duration: reservation.duration
    });
    
    // Check token before making request
    const token = this.authService.getToken();
    console.log('Token available for reservation:', token ? 'Yes' : 'No');
    
    // Make the API request
    return this.http.post<Reservation>(`${this.apiUrl}/reservations`, reservation, { 
      headers: this.getHeaders(),
      observe: 'response'
    }).pipe(
      map(response => {
        console.log('Reservation successful, status:', response.status);
        return response.body as Reservation;
      }),
      catchError(error => {
        console.error('Error creating reservation:', error);
        return this.handleError(error);
      })
    );
  }

  updateReservation(id: number, reservation: Reservation): Observable<Reservation> {
    return this.http.put<Reservation>(`${this.apiUrl}/reservations/${id}`, reservation, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/reservations/${id}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: any) {
    console.error('API Error:', error);
    
    // Check for common auth errors and try to provide helpful messages
    if (error.status === 401) {
      console.error('Authentication failed - token may be invalid or expired');
      // Clear any invalid tokens and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('accessToken');
      window.location.href = '/login'; // Force navigation to login page
    } else if (error.status === 403) {
      console.error('Authorization failed - user does not have required permissions');
      // Check if this is an issue with the token format
      const token = this.authService.getToken();
      if (token) {
        try {
          // Try to decode the token to see if it's properly formed
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          console.log('Token payload:', payload);
          console.log('Token exp:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'No expiration');
          console.log('Current time:', new Date().toISOString());
          
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.error('Token is expired - redirecting to login');
            this.authService.logout();
            window.location.href = '/login';
          }
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }
    }
    
    let errorMsg: string;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMsg = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMsg = error.error?.message || 
                error.error?.error || 
                `Error Code: ${error.status}, Message: ${error.message}`;
    }
    
    return throwError(() => new Error(errorMsg));
  }
}
