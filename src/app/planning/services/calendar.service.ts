import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamMember {
  userId: number;
  employeeName: string;
  dailyStatuses: DailyStatus[];
}

export interface DailyStatus {
  date: string;
  status: 'OFFICE' | 'TELETRAVAIL' | 'PENDING' | 'VACATION' | 'MEETING';
  requestId?: number;
}

export interface TeamCalendarResponse {
  teamName: string;
  startDate: string;
  endDate: string;
  teamMembers: TeamMember[];
}

export interface StatusUpdateRequest {
  status: string;
  rejectionReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private apiUrl = 'http://localhost:8001';
  
  constructor(private http: HttpClient) { }
  
  /**
   * Get team calendar for the specified team and date range
   * 
   * @param teamId ID of the team 
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   * @returns Observable with team calendar data
   */
  getTeamCalendar(teamName: string, startDate: string, endDate: string): Observable<TeamCalendarResponse> {
    return this.http.get<TeamCalendarResponse>(
      `${this.apiUrl}/api/calendar/team/${teamName}?startDate=${startDate}&endDate=${endDate}`
    );
  }
  
  /**
   * Update the status of a teletravail request
   * 
   * @param requestId ID of the request to update
   * @param status New status (CONFIRMED or REJECTED)
   * @param rejectionReason Reason for rejection (if status is REJECTED)
   * @returns Observable with updated request
   */
  updateRequestStatus(requestId: number, status: string, rejectionReason?: string): Observable<any> {
    const request: StatusUpdateRequest = {
      status: status,
      rejectionReason: rejectionReason
    };
    
    return this.http.put(
      `${this.apiUrl}/api/calendar/request/${requestId}/status`, 
      request
    );
  }
  
  /**
   * Maps work status from backend to icon class
   * 
   * @param status Backend work status
   * @returns CSS class for the appropriate icon
   */
  /**
   * Maps work status from backend to icon class
   * 
   * @param status Backend work status
   * @returns CSS class for the appropriate icon
   */
  getStatusIconClass(status: string): string {
    // Ensure case-insensitive comparison
    const normalizedStatus = status?.toUpperCase() || '';
    
    switch (normalizedStatus) {
      case 'TELETRAVAIL':
      case 'TÉLÉTRAVAIL':
      case 'APPROVED':     // Map APPROVED to teletravail icon
      case 'CONFIRMED':    // Map CONFIRMED to teletravail icon
        return 'bi bi-house-door teletravail-icon';
        
      case 'PENDING':
      case 'EN ATTENTE':   // Map French status as well
        return 'bi bi-house-door teletravail-icon pending-icon';
        
      case 'VACATION':
        return 'bi bi-umbrella beach-icon';
        
      case 'MEETING':
        return 'bi bi-people meeting-icon';
        
      case 'OFFICE':
      case 'BUREAU':       // French version
      case 'REJECTED':
      case 'REFUSED': 
      default:
        return 'bi bi-building office-icon';
    }
  }
  
  /**
   * Gets the display label for a status
   * 
   * @param status Backend work status 
   * @returns Human-readable status label in French
   */
  getStatusLabel(status: string): string {
    // Ensure case-insensitive comparison
    const normalizedStatus = status?.toUpperCase() || '';
    
    switch (normalizedStatus) {
      case 'TELETRAVAIL':
      case 'TÉLÉTRAVAIL':
      case 'APPROVED':
      case 'CONFIRMED':
        return 'Télétravail';
        
      case 'PENDING':
        return 'En attente';
        
      case 'VACATION':
        return 'Congé';
        
      case 'MEETING':
        return 'Réunion';
        
      case 'OFFICE':
      case 'BUREAU':
      case 'REJECTED':
      case 'REFUSED':
      default:
        return 'Bureau';
    }
  }
}
