import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../login/AuthService';

export interface Reservation {
  id?: number;
  deskId: number;
  bookingDate: string;
  duration: 'AM' | 'PM' | 'FULL';
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
    
    // For debugging - check if user is logged in and has admin role
    console.log('User logged in:', this.authService.isLoggedIn());
    console.log('User is admin:', this.authService.isAdmin());
    
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
        catchError(error => this.handleError(error))
      );
  }

  updatePlan(planId: number, plan: Plan): Observable<Plan> {
    console.log(`Updating plan ${planId} with dimensions:`, { width: plan.width, height: plan.height });
    return this.http.put<Plan>(`${this.apiUrl}/plans/${planId}`, plan, { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  deletePlan(planId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/plans/${planId}`, { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Desk API methods
  getDesksByPlanId(planId: number): Observable<Desk[]> {
    return this.http.get<Desk[]>(`${this.apiUrl}/desks/plan/${planId}`, { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getAvailableDesks(planId: number, date: string): Observable<Desk[]> {
    return this.http.get<Desk[]>(`${this.apiUrl}/desks/available?planId=${planId}&date=${date}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  createDesk(planId: number, desk: Desk): Observable<Desk> {
    return this.http.post<Desk>(`${this.apiUrl}/desks/plan/${planId}`, desk, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  updateDesk(deskId: number, desk: Desk): Observable<Desk> {
    return this.http.put<Desk>(`${this.apiUrl}/desks/${deskId}`, desk, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  deleteDesk(deskId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/desks/${deskId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Wall API methods
  getWallsByPlanId(planId: number): Observable<Wall[]> {
    return this.http.get<Wall[]>(`${this.apiUrl}/walls/plan/${planId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  createWall(planId: number, wall: Wall): Observable<Wall> {
    return this.http.post<Wall>(`${this.apiUrl}/walls/plan/${planId}`, wall, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  updateWall(wallId: number, wall: Wall): Observable<Wall> {
    return this.http.put<Wall>(`${this.apiUrl}/walls/${wallId}`, wall, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  deleteWall(wallId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/walls/${wallId}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  // Reservation API methods
  
  // Update only the duration of an existing reservation
  updateReservationDuration(reservationId: number, duration: string): Observable<Reservation> {
    return this.http.patch<Reservation>(
      `${this.apiUrl}/reservations/${reservationId}/duration`, 
      { duration: duration },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  getUserReservations(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations/user`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getReservationsByDate(date: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations/date?date=${date}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  getUserReservationsInDateRange(startDate: string, endDate: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(
      `${this.apiUrl}/reservations/user/daterange?startDate=${startDate}&endDate=${endDate}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }
  
  getAllReservationsInDateRange(startDate: string, endDate: string): Observable<Reservation[]> {
    // Changed to use a different endpoint format to avoid the 'daterange' path parameter that's causing conversion errors
    // The error suggests the Spring backend is trying to convert 'daterange' to a Long ID
    return this.http.get<Reservation[]>(
      `${this.apiUrl}/reservations?startDate=${startDate}&endDate=${endDate}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error fetching reservations in date range:', error);
          
          // Fall back to fetching individual days if the range endpoint fails
          if (error.status === 500 || error.status === 404) {
            console.log('Falling back to fetching individual days');
            // Parse the dates
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Create an array of all dates in the range
            const dates: string[] = [];
            const currentDate = new Date(start);
            while (currentDate <= end) {
              const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
              dates.push(dateStr);
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Create an array of observables for each date
            const requests = dates.map(date => 
              this.getReservationsByDate(date)
            );
            
            // Fetch all and combine results
            return forkJoin(requests).pipe(
              map((results: Reservation[][]) => {
                // Flatten the array of arrays
                return results.reduce((acc: Reservation[], curr: Reservation[]) => acc.concat(curr), [] as Reservation[]);
              })
            );
          }
          
          return this.handleError(error);
        })
      );
  }
  
  getReservationsByDateAndDesk(deskId: number, startDate: string, endDate: string): Observable<Reservation[]> {
    console.log(`Fetching reservations for desk ${deskId} from ${startDate} to ${endDate}`);
    
    // Using the existing getReservationsByDate endpoint since the specific desk/daterange endpoint might not exist
    return this.getAllReservationsInDateRange(startDate, endDate)
      .pipe(
        map(reservations => {
          console.log(`Got ${reservations.length} total reservations from server`);
          console.log('Raw reservation data:', JSON.stringify(reservations));
          
          // Filter to only include reservations for this specific desk
          const filteredReservations = reservations.filter(res => res.deskId === deskId);
          
          console.log(`Found ${filteredReservations.length} reservations for desk ${deskId}:`, 
                     filteredReservations.map(r => r.bookingDate).join(', '));
          
          return filteredReservations;
        }),
        catchError(error => {
          console.error('Error fetching reservations:', error);
          return this.handleError(error);
        })
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
        catchError(error => this.handleError(error))
      );
  }

  deleteReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/reservations/${id}`, 
      { headers: this.getHeaders() })
      .pipe(
        catchError(error => this.handleError(error))
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
        console.log('Token is present but the request still failed');
      }
    }
    
    let errorMsg: string;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMsg = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 403) {
        // Handle permission errors with better UX
        const isPlansEndpoint = error.url?.includes('/plans');
        
        if (isPlansEndpoint) {
          // Plans-specific 403 error - likely a permissions issue
          errorMsg = 'You don\'t have permission to modify floor plans. This action requires admin privileges.';
        } else {
          // Generic 403 error
          errorMsg = 'Access denied. Your current role doesn\'t have permission to perform this action. Admin privileges may be required.';
        }
      } else if (error.status === 409 && error.url?.includes('/plans')) {
        // Conflict for plans - could be the "only one floor plan" business rule
        errorMsg = 'Only one floor plan can exist at a time. Please delete the existing plan before creating a new one.';
      } else {
        // Generic error handling
        errorMsg = error.error?.message ||
                  error.error?.error ||
                  `Unable to complete request. Please try again or contact support if the problem persists.`;
      }
    }
    
    return throwError(() => new Error(errorMsg));
  }
}
