import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlanningEntry {
  date: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class PlanningAiService {
  private apiUrl = 'http://localhost:8000/api/ai/suggestions';

  constructor(private http: HttpClient) {}

  getSmartSuggestions(userId: number, planning: PlanningEntry[]): Observable<{ suggestions: string[] }> {
    return this.http.post<{ suggestions: string[] }>(this.apiUrl, {
      user_id: userId,
      planning: planning
    });
  }
} 