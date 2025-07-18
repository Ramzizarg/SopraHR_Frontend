import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AIAnalysis {
  timestamp: string;
  telework_analysis: {
    current_percentage: number;
    trend: string;
    recommendations: any[];
    warnings: any[];
    alerts: any[];
    daily_percentages: { date: string; percentage: number }[];
    weekly_percentage: number;
    monthly_percentage: number;
  };
  reservation_analysis: {
    current_occupancy: number;
    average_occupancy: number;
    trend: string;
    recommendations: any[];
    warnings: any[];
    alerts: any[];
    workstation_recommendations: any[];
  };
  predictions: {
    occupancy: {
      predictions: any[];
      confidence: number;
    };
    telework: {
      predictions: any[];
      confidence: number;
    };
  };
  anomalies: {
    occupancy: string[];
    telework: string[];
  };
  summary: {
    total_alerts: number;
    total_warnings: number;
    total_recommendations: number;
    priority_actions: any[];
  };
}

export interface AIRecommendations {
  recommendations: {
    telework_recommendations: any[];
    reservation_recommendations: any[];
    workstation_recommendations: any[];
    alerts: any[];
    warnings: any[];
  };
  summary: {
    total_alerts: number;
    total_warnings: number;
    total_recommendations: number;
    priority_actions: any[];
  };
  timestamp: string;
}

export interface RealtimeData {
  realtime_data: {
    reservation: any;
    telework: any;
    date: string;
  };
  analysis: {
    today_occupancy: number;
    today_telework: number;
    status: string;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIDecisionService {
  private apiUrl = environment.aiApiUrl || 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  // Get current AI analysis
  getCurrentAnalysis(): Observable<{ analysis: AIAnalysis, last_updated: string, cache_age_minutes: number }> {
    return this.http.get<{ analysis: AIAnalysis, last_updated: string, cache_age_minutes: number }>(`${this.apiUrl}/analysis/current`);
  }

  // Get telework analysis
  getTeleworkAnalysis(): Observable<any> {
    return this.http.get(`${this.apiUrl}/analysis/telework`);
  }

  // Get reservation analysis
  getReservationAnalysis(): Observable<any> {
    return this.http.get(`${this.apiUrl}/analysis/reservation`);
  }

  // Get AI recommendations
  getRecommendations(): Observable<AIRecommendations> {
    return this.http.get<AIRecommendations>(`${this.apiUrl}/recommendations`);
  }

  // Get occupancy predictions
  getOccupancyPredictions(days: number = 30): Observable<any> {
    return this.http.get(`${this.apiUrl}/predictions/occupancy?days=${days}`);
  }

  // Get telework predictions
  getTeleworkPredictions(days: number = 30): Observable<any> {
    return this.http.get(`${this.apiUrl}/predictions/telework?days=${days}`);
  }

  // Get anomalies
  getAnomalies(): Observable<any> {
    return this.http.get(`${this.apiUrl}/anomalies`);
  }

  // Get real-time data
  getRealtimeData(): Observable<RealtimeData> {
    return this.http.get<RealtimeData>(`${this.apiUrl}/realtime`);
  }

  // Force refresh analysis
  refreshAnalysis(): Observable<any> {
    return this.http.post(`${this.apiUrl}/analysis/refresh`, {});
  }

  // Health check
  getHealthStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }

  // Helper method to get status color
  getStatusColor(status: string): string {
    switch (status) {
      case 'critical_high':
        return '#dc3545'; // Red
      case 'warning_high':
        return '#fd7e14'; // Orange
      case 'normal':
        return '#28a745'; // Green
      case 'warning_low':
        return '#ffc107'; // Yellow
      case 'critical_low':
        return '#6f42c1'; // Purple
      default:
        return '#6c757d'; // Gray
    }
  }

  // Helper method to get trend icon
  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'increasing':
        return 'trending_up';
      case 'decreasing':
        return 'trending_down';
      case 'stable':
        return 'trending_flat';
      default:
        return 'trending_flat';
    }
  }

  // Helper method to get alert severity
  getAlertSeverity(alert: any): string {
    switch (alert.type) {
      case 'CRITICAL':
        return 'danger';
      case 'WARNING':
        return 'warning';
      case 'INFO':
        return 'info';
      default:
        return 'secondary';
    }
  }
} 