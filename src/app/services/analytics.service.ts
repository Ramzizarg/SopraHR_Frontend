import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interface for dashboard analytics metrics
 */
export interface AnalyticsMetrics {
  totalEmployees: number;
  officePresence: number;
  remoteWork: number;
  reservationCount: number;
  occupancyRate: number;
  employeeGrowthRate: number;
  officePresencePercentage: number;
  officePresenceChange: number;
  teamDistribution: {
    team: string;
    count: number;
  }[];
  weeklyOccupancy: {
    day: string;
    percentage: number;
  }[];
  approvalRates: {
    approved: number;
    rejected: number;
    pending: number;
  };
  allEmployees: {
    id: number;
    firstName: string;
    lastName: string;
    team: string;
    email: string;
  }[];
}

/**
 * Service for fetching analytics data from the backend
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = 'http://localhost:5001/api/v1/analytics';

  constructor(private http: HttpClient) {}

  /**
   * Get dashboard metrics aggregated from all microservices
   * @returns Observable of analytics metrics
   */
  getDashboardMetrics(): Observable<AnalyticsMetrics> {
    return this.http.get<AnalyticsMetrics>(`${this.apiUrl}/dashboard`);
  }

  /**
   * Get weekly analytics data
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Observable of weekly analytics data
   */
  getWeeklyAnalytics(startDate?: string, endDate?: string): Observable<any> {
    let url = `${this.apiUrl}/weekly`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    return this.http.get<any>(url);
  }

  /**
   * Get team-based analytics
   * @returns Observable of team analytics data
   */
  getTeamAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/teams`);
  }

  /**
   * Get team-specific analytics for a particular team
   * @param teamName Name of the team (e.g., "DEV", "QA", "OPS", "RH")
   * @returns Observable of team-specific analytics
   */
  getTeamSpecificAnalytics(teamName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/teams/${teamName}`);
  }
}
