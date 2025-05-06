import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PlanningResponse, PlanningGenerationRequest } from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  private apiUrl = 'http://localhost:8001/api/planning';

  constructor(private http: HttpClient) { }

  /**
   * Get planning for current user
   */
  getUserPlanning(userId: number, startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    return this.http.get<PlanningResponse[]>(`${this.apiUrl}/user/${userId}`, { params });
  }

  /**
   * Get all planning entries
   */
  getAllPlanning(startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    return this.http.get<PlanningResponse[]>(this.apiUrl, { params });
  }

  /**
   * Generate planning from teletravail requests
   */
  generatePlanning(request: PlanningGenerationRequest): Observable<PlanningResponse[]> {
    return this.http.post<PlanningResponse[]>(`${this.apiUrl}/generate`, request);
  }

  /**
   * Generate automatic planning based on rules
   */
  generateAutomaticPlanning(userId: number, startDate: string, endDate: string): Observable<PlanningResponse[]> {
    const params = new HttpParams()
      .set('userId', userId.toString())
      .set('startDate', startDate)
      .set('endDate', endDate);
    
    return this.http.post<PlanningResponse[]>(`${this.apiUrl}/generate-automatic`, null, { params });
  }

  /**
   * Update planning status
   */
  updatePlanningStatus(id: number, status: string): Observable<PlanningResponse> {
    const params = new HttpParams().set('status', status);
    return this.http.put<PlanningResponse>(`${this.apiUrl}/${id}/status`, null, { params });
  }

  /**
   * Delete planning
   */
  deletePlanning(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
