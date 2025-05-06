import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the token directly from localStorage
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
    
    // Log for debugging
    console.log(`Intercepting request to ${request.url}`);
    console.log(`Token exists: ${!!token}`);
    
    // Only add the token if it exists
    if (token) {
      // Clone the request and add the Authorization header
      const authReq = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Added Authorization header');
      
      // Forward the cloned request with the token
      return next.handle(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            console.error(`Auth error ${error.status} occurred:`, error);
            // Clear tokens and redirect to login page for auth errors
            localStorage.removeItem('auth_token');
            localStorage.removeItem('accessToken');
            this.router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    }
    
    // If no token, just forward the original request
    return next.handle(request);
  }
}
