export interface PlanningResponse {
  id: number;
  userId: number;
  userName: string;
  planningDate: string;
  planningStatus: string;
  location: string;
  workType: string;
  reasons: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningGenerationRequest {
  startDate: string;
  endDate: string;
  userId?: number;
}
