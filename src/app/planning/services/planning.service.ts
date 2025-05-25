import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { PlanningResponse, PlanningGenerationRequest, TeletravailRequest, mapTeletravailToPlanningResponse } from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  // Updated to use teletravail service instead of planning service
  private apiUrl = 'http://localhost:7001/api/teletravail';
  private userApiUrl = 'http://localhost:9001/api/users';

  constructor(private http: HttpClient) { }

  /**
   * Get planning for current user
   */
  getUserPlanning(userId: number, startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    // Updated to use new teletravail endpoint with date range
    return this.http.get<TeletravailRequest[]>(`${this.apiUrl}/user/${userId}/date-range`, { params })
      .pipe(
        map(requests => requests.map(request => mapTeletravailToPlanningResponse(request)))
      );
  }

  /**
   * Get all planning entries
   */
  getAllPlanning(startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    // Updated to use new teletravail endpoint for all planning requests (manager view)
    return this.http.get<TeletravailRequest[]>(`${this.apiUrl}/planning/all`, { params })
      .pipe(
        map(requests => requests.map(request => mapTeletravailToPlanningResponse(request)))
      );
  }
  
  /**
   * Get all team members for a specific team
   * This is needed to display all team members in the calendar, even if they don't have teletravail entries
   */
  getTeamMembers(teamName: string): Observable<any[]> {
    if (!teamName) {
      // Default to DEV team if no team specified
      teamName = 'DEV';
    }
    
    // Normalize team name to uppercase to match backend normalization
    const normalizedTeamName = teamName.toUpperCase();
    console.log('Fetching team members for team:', normalizedTeamName);
    console.log('API URL:', `${this.userApiUrl}/team/${normalizedTeamName}`);
    
    // Call user service endpoint to get all members of a specific team
    return this.http.get<any[]>(`${this.userApiUrl}/team/${normalizedTeamName}`)
      .pipe(
        map(response => {
          console.log('Team members API response:', response);
          return response;
        })
      );
  }

  /**
   * Get planning for a team (for team leaders)
   * Using team name directly
   */
  getTeamPlanning(teamName: string, startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    // Updated to use new teletravail endpoint for team view
    return this.http.get<TeletravailRequest[]>(`${this.apiUrl}/team/${teamName}`, { params })
      .pipe(
        map(requests => requests.map(request => mapTeletravailToPlanningResponse(request)))
      );
  }

  /**
   * Cancel/delete a teletravail request
   * @param teletravailId The ID of the teletravail request to cancel
   */
  cancelTeletravailRequest(teletravailId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${teletravailId}`);
  }
  
  /**
   * Approve a teletravail request (for team leaders and managers)
   * @param teletravailId The ID of the teletravail request to approve
   */
  approveTeletravailRequest(teletravailId: number): Observable<any> {
    const requestDTO = {
      status: 'APPROVED',
      rejectionReason: null
    };
    return this.http.put(`${this.apiUrl}/${teletravailId}/status`, requestDTO);
  }
  
  /**
   * Reject a teletravail request (for team leaders and managers)
   * @param teletravailId The ID of the teletravail request to reject
   * @param rejectionReason The reason for rejection
   */
  rejectTeletravailRequest(teletravailId: number, rejectionReason: string): Observable<any> {
    const requestDTO = {
      status: 'REJECTED',
      rejectionReason: rejectionReason
    };
    return this.http.put(`${this.apiUrl}/${teletravailId}/status`, requestDTO);
  }

  // Planning-specific methods have been removed as all planning entries are now managed
  // directly through the teletravail service
  
  /**
   * Get all users in the system (for managers to view everyone in calendar)
   * @returns Observable of all users in the system
   */
  getAllUsers(): Observable<any[]> {
    console.log('Getting all users from:', `${this.userApiUrl}`);
    
    // Call the user service endpoint to get all users
    return this.http.get<any[]>(`${this.userApiUrl}`)
      .pipe(
        map(response => {
          console.log('All users API response:', response);
          return response;
        })
      );
  }
}
