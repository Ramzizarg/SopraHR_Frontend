export interface PlanningResponse {
  id: number;
  userId: number;
  userName: string;
  employeeName?: string; // Full name of employee, may be different from userName in some cases
  team?: string; // Added team field to store team name (e.g., "DEV", "QA", "OPS", "RH")
  role?: string; // User's role (EMPLOYEE, TEAM_LEADER, MANAGER, ADMIN)
  planningDate: string;
  planningStatus: string;
  location: string;
  workType: string;
  reasons: string;
  rejectionReason?: string; // Added rejection reason field
  createdAt: string;
  updatedAt: string;
}

export interface PlanningGenerationRequest {
  startDate: string;
  endDate: string;
  userId?: number;
}

// New model for teletravail requests that will also serve as planning entries
export interface TeletravailRequest {
  id: number;
  userId: number;
  userName?: string; // Field from TeletravailResponseDTO
  employeeName?: string; // Additional field that might be in the backend
  team: string; // Team name (e.g., "DEV", "QA", "OPS", "RH")
  role?: string; // User's role (EMPLOYEE, TEAM_LEADER, MANAGER, ADMIN)
  teamLeaderId: number;
  teletravailDate: string;
  travailType: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  statusUpdatedAt?: string;
  createdAt: string;
  profilePhotoUrl?: string; // URL for the user's profile photo
  selected?: boolean; // Property for selection state
}

// Transform TeletravailRequest to PlanningResponse for backward compatibility
export function mapTeletravailToPlanningResponse(teletravail: TeletravailRequest): PlanningResponse {
  // Choose the best available name field, checking both userName and employeeName
  let displayName = '';
  
  // Check employeeName first (from backend TeletravailRequest entity)
  if (teletravail.employeeName && teletravail.employeeName.trim() !== '') {
    displayName = teletravail.employeeName;
  }
  // Then check userName (from TeletravailResponseDTO) 
  else if (teletravail.userName && teletravail.userName.trim() !== '') {
    displayName = teletravail.userName;
  }
  // Fallback to userId identifier
  else {
    displayName = `Utilisateur #${teletravail.userId}`;
  }
  
  return {
    id: teletravail.id,
    userId: teletravail.userId,
    userName: displayName,
    // Explicitly set employeeName to preserve it from original teletravail request 
    employeeName: teletravail.employeeName || displayName,
    team: teletravail.team, // Ensure team information is included
    role: teletravail.role, // Include role information if available
    planningDate: teletravail.teletravailDate,
    planningStatus: teletravail.status,
    location: teletravail.travailMaison === 'oui' ? 'Domicile' : `${teletravail.selectedPays || ''} ${teletravail.selectedGouvernorat ? '- ' + teletravail.selectedGouvernorat : ''}`.trim(),
    workType: teletravail.travailType,
    reasons: teletravail.reason || '',
    rejectionReason: teletravail.rejectionReason,
    createdAt: teletravail.createdAt,
    updatedAt: teletravail.statusUpdatedAt || teletravail.createdAt
  };
}
