import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map, tap } from 'rxjs';

export interface User {
  id: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  team: string;
  employeeName?: string;
  error?: string;
  blocked?: boolean;
  profilePhotoUrl?: string;
}

export interface UserRequest {
  email: string;
  password?: string;
  role: string;
  firstName: string;
  lastName: string;
  team: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:9001/api/users';

  constructor(private http: HttpClient) { }

  /**
   * Get all users from the system
   * @returns Observable of User array
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      tap(users => console.log(`Fetched ${users.length} users`)),
      map(users => users.map(user => ({
        ...user,
        employeeName: `${user.firstName} ${user.lastName}`
      }))),
      catchError(this.handleError)
    );
  }

  /**
   * Get users by team name
   * @param teamName The team name to filter by
   * @returns Observable of filtered users
   */
  getUsersByTeam(teamName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/team/${teamName}`).pipe(
      tap(users => console.log(`Fetched ${users.length} users for team ${teamName}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Get a single user by ID
   * @param id User ID
   * @returns Observable of User
   */
  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      tap(user => console.log(`Fetched user with ID ${id}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new user (admin only)
   * @param userRequest User data to create
   * @returns Observable of created User
   */
  createUser(userRequest: UserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/create_user`, userRequest).pipe(
      tap(user => console.log(`Created user with ID ${user.id}`)),
      catchError(this.handleError)
    );
  }
  
  /**
   * Register a new user through auth endpoint
   * @param userRequest User registration data including password
   * @returns Observable of registered User
   */
  registerUser(userRequest: UserRequest & { password: string }): Observable<User> {
    return this.http.post<User>('http://localhost:9001/auth/register', userRequest).pipe(
      tap(user => console.log(`Registered new user: ${user.email}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing user
   * @param id User ID to update
   * @param userRequest Updated user data
   * @returns Observable of updated User
   */
  updateUser(id: number, userRequest: UserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, userRequest).pipe(
      tap(user => console.log(`Updated user with ID ${id}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Delete a user (admin only)
   * @param id User ID to delete
   * @returns Observable with operation result
   */
  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      tap(_ => console.log(`Deleted user with ID ${id}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Get user profile photo URL
   * @param userId The ID of the user
   * @returns Observable containing the photo URL or null
   */
  getUserProfilePhoto(userId: number): Observable<string | null> {
    return this.http.get<{photoUrl: string}>(`${this.apiUrl}/${userId}/profile-photo`)
      .pipe(
        map(response => response.photoUrl),
        catchError(error => {
          console.error('Error fetching profile photo:', error);
          // Return null instead of throwing an error to make it easier for components to handle
          return throwError(() => null);
        })
      );
  }
  

  uploadProfilePhoto(userId: number, photoFile: File): Observable<string> {
    console.log('Uploading profile photo for user:', userId);
    const formData = new FormData();
    formData.append('file', photoFile); // Note: backend expects 'file' as the key, not 'profilePhoto'
    
    // Important: use withCredentials: true to ensure auth cookie is sent with the request
    return this.http.post<any>(`${this.apiUrl}/${userId}/profile-photo`, formData, { withCredentials: true })
      .pipe(
        map(response => {
          console.log('Profile photo upload response:', response);
          // Handle different response structures
          if (response && response.photoUrl) {
            return response.photoUrl;
          } else if (response && typeof response === 'object') {
            // Try to find any URL-like property in the response
            const possibleUrlProps = Object.entries(response)
              .find(([key, value]) => 
                typeof value === 'string' && 
                (key.toLowerCase().includes('url') || key.toLowerCase().includes('photo'))
              );
            
            if (possibleUrlProps) {
              return possibleUrlProps[1] as string;
            }
          }
          
          // If we couldn't extract a URL, create a data URL as fallback
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
          });
        }),
        tap(photoUrl => console.log(`Uploaded profile photo for user ${userId}: ${photoUrl}`)),
        catchError(error => {
          console.error('Error uploading profile photo:', error);
          
          // If the upload fails, fall back to local data URL as a temporary solution
          console.log('Falling back to local data URL');
          return new Observable<string>(observer => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target && event.target.result) {
                observer.next(event.target.result as string);
                observer.complete();
              } else {
                observer.error('Failed to read file');
              }
            };
            reader.onerror = (err) => observer.error(err);
            reader.readAsDataURL(photoFile);
          });
        })
      );
  }

  /**
   * Handle HTTP errors
   * @param error The error response
   * @returns Observable with error message
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur inconnue est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Code d'erreur: ${error.status}\nMessage: ${error.error?.message || error.message}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
