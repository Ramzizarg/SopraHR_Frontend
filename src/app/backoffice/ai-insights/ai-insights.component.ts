import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { AIDecisionService, AIAnalysis, AIRecommendations, RealtimeData } from '../../services/ai-decision.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../login/AuthService';
import { UserService } from '../users/user.service';
import Swal from 'sweetalert2';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
}

@Component({
  selector: 'app-ai-insights',
  templateUrl: './ai-insights.component.html',
  styleUrls: ['./ai-insights.component.css']
})
export class AIInsightsComponent implements OnInit, OnDestroy {
  // Sidebar and UI states
  isSidebarOpen: boolean = true;
  isProfileDropdownOpen: boolean = false;
  searchTerm: string = '';
  userProfilePhotos: Map<number, string | null> = new Map();

  @ViewChild('profileElement') profileElement!: ElementRef;

  profile: any = null; // --- Added for user profile ---
  aiAnalysis: AIAnalysis | null = null;
  recommendations: AIRecommendations | null = null;
  realtimeData: RealtimeData | null = null;
  loading = true;
  error = false;
  lastUpdated: string = '';

  private refreshSubscription: Subscription | null = null;
  private realtimeSubscription: Subscription | null = null;

  // --- Telework week navigation state ---
  currentWeekStart: Date | null = null;

  constructor(
    private aiService: AIDecisionService,
    public authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.loadData();
    this.startAutoRefresh();
    this.startRealtimeUpdates();
    this.fetchProfile(); // --- Fetch user profile on init ---
    this.loadStoredProfilePhoto();
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }

  loadData(): void {
    this.loading = true;
    this.error = false;

    // Load current analysis
    this.aiService.getCurrentAnalysis().subscribe({
      next: (data) => {
        this.aiAnalysis = data.analysis;
        this.lastUpdated = new Date().toLocaleString();
        this.loading = false;
        // Set current week to this week (Monday), or next week if today is Saturday/Sunday
        if (this.aiAnalysis?.telework_analysis?.daily_percentages?.length) {
          const lastDateStr = this.aiAnalysis.telework_analysis.daily_percentages[this.aiAnalysis.telework_analysis.daily_percentages.length - 1].date;
          const lastDate = new Date(lastDateStr);
          const today = new Date();
          const todayDay = today.getDay();
          if (todayDay === 6) { // Saturday
            const nextMonday = new Date(today);
            nextMonday.setDate(today.getDate() + 2);
            this.currentWeekStart = getMonday(nextMonday);
          } else if (todayDay === 0) { // Sunday
            const nextMonday = new Date(today);
            nextMonday.setDate(today.getDate() + 1);
            this.currentWeekStart = getMonday(nextMonday);
          } else {
            this.currentWeekStart = getMonday(lastDate);
          }
        }
      },
      error: (err) => {
        console.error('Error loading AI analysis:', err);
        this.error = true;
        this.loading = false;
      }
    });

    // Load recommendations
    this.aiService.getRecommendations().subscribe({
      next: (data) => {
        this.recommendations = data;
      },
      error: (err) => {
        console.error('Error loading recommendations:', err);
      }
    });
  }

  // --- Telework week navigation logic ---
  getCurrentWeekDays(): { date: string, percentage: number }[] {
    if (!this.currentWeekStart) return [];
    const weekStart = new Date(this.currentWeekStart);
    const result: { date: string, percentage: number }[] = [];
    const dailyMap = new Map<string, number>();
    if (this.aiAnalysis?.telework_analysis?.daily_percentages) {
      for (const day of this.aiAnalysis.telework_analysis.daily_percentages) {
        dailyMap.set(new Date(day.date).toISOString().slice(0, 10), day.percentage);
      }
    }
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dayOfWeek = d.getDay();
      // Only Monday (1) to Friday (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateStr = d.toISOString().slice(0, 10);
        result.push({
          date: dateStr,
          percentage: dailyMap.get(dateStr) ?? 0
        });
      }
    }
    return result;
  }

  showPrevWeek(): void {
    if (!this.currentWeekStart) return;
    const prev = new Date(this.currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    this.currentWeekStart = getMonday(prev);
  }

  showNextWeek(): void {
    if (!this.currentWeekStart) return;
    const next = new Date(this.currentWeekStart);
    next.setDate(next.getDate() + 7);
    this.currentWeekStart = getMonday(next);
  }

  getWeekRangeLabel(): string {
    if (!this.currentWeekStart) return '';
    const weekStart = new Date(this.currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    const year = weekEnd.getFullYear();
    return `${weekStart.toLocaleDateString('fr-FR', options)} au ${weekEnd.toLocaleDateString('fr-FR', options)} ${year}`;
  }

  startAutoRefresh(): void {
    // Refresh data every 5 minutes
    this.refreshSubscription = interval(5 * 60 * 1000).subscribe(() => {
      this.loadData();
    });
  }

  startRealtimeUpdates(): void {
    // Update real-time data every 30 seconds
    this.realtimeSubscription = interval(30 * 1000).pipe(
      switchMap(() => this.aiService.getRealtimeData())
    ).subscribe({
      next: (data) => {
        this.realtimeData = data;
      },
      error: (err) => {
        console.error('Error loading real-time data:', err);
      }
    });
  }

  refreshData(): void {
    this.aiService.refreshAnalysis().subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        console.error('Error refreshing analysis:', err);
      }
    });
  }

  getStatusColor(status: string): string {
    return this.aiService.getStatusColor(status);
  }

  getTrendIcon(trend: string): string {
    return this.aiService.getTrendIcon(trend);
  }

  getAlertSeverity(alert: any): string {
    return this.aiService.getAlertSeverity(alert);
  }

  getOccupancyStatus(occupancy: number): string {
    if (occupancy > 90) return 'critical_high';
    if (occupancy > 80) return 'warning_high';
    if (occupancy > 70) return 'normal';
    if (occupancy > 60) return 'warning_low';
    return 'critical_low';
  }

  getTeleworkStatus(percentage: number): string {
    if (percentage > 60) return 'critical_high';
    if (percentage > 50) return 'warning_high';
    if (percentage > 20) return 'normal';
    return 'warning_low';
  }

  getWorkstationRecommendationText(recommendation: any): string {
    if (recommendation.action === 'ADD') {
      return `Ajouter ${recommendation.quantity} poste(s) de travail`;
    } else if (recommendation.action === 'REMOVE') {
      return `Supprimer ${recommendation.quantity} poste(s) de travail`;
    }
    return recommendation.reason || 'Action recommandée';
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'HIGH':
        return 'priority_high';
      case 'MEDIUM':
        return 'remove';
      case 'LOW':
        return 'low_priority';
      default:
        return 'info';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'HIGH':
        return '#dc3545';
      case 'MEDIUM':
        return '#fd7e14';
      case 'LOW':
        return '#28a745';
      default:
        return '#6c757d';
    }
  }

  get totalRecommendations(): number {
    return (this.aiAnalysis?.reservation_analysis?.workstation_recommendations?.length || 0);
  }

  getCurrentWeekAverage(): string {
    const days = this.getCurrentWeekDays();
    if (!days.length) return '0.0';
    const avg = days.reduce((sum, d) => sum + d.percentage, 0) / days.length;
    return avg.toFixed(1);
  }

  isToday(dateStr: string): boolean {
    const today = new Date();
    const d = new Date(dateStr);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
    }
  }

  fetchProfile(): void {
    this.authService.loadUserProfile().subscribe({
      next: (data: any) => {
        this.profile = data;
      },
      error: (err: any) => {
        console.error('Error fetching profile:', err);
      }
    });
  }

  loadStoredProfilePhoto(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const storedPhotoUrl = localStorage.getItem(`profilePhoto_${currentUser.id}`);
      if (storedPhotoUrl) {
        currentUser.profilePhotoUrl = storedPhotoUrl;
        this.authService.updateCurrentUser(currentUser);
      }
    }
  }

  fetchUserProfilePhoto(userId: number): void {
    this.userService.getUserProfilePhoto(userId).subscribe({
      next: (photoUrl) => {
        if (photoUrl) {
          this.userProfilePhotos.set(userId, photoUrl);
          const currentUser = this.authService.currentUserValue;
          if (currentUser && currentUser.id === userId) {
            currentUser.profilePhotoUrl = photoUrl;
            localStorage.setItem(`profilePhoto_${userId}`, photoUrl);
            this.authService.updateCurrentUser(currentUser);
          }
        }
      },
      error: (error) => {
        console.error('Error fetching profile photo for user', userId, error);
      }
    });
  }

  getUserProfilePhoto(userId: number): string | null {
    return this.userProfilePhotos.get(userId) || null;
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event): void {
    if (this.profileElement && !this.profileElement.nativeElement.contains(event.target)) {
      this.isProfileDropdownOpen = false;
    }
  }

  editProfile(): void {
    this.isProfileDropdownOpen = false;
    Swal.fire({
      title: 'Modifier le profil',
      html: `
        <div class="profile-edit-container">
          <div class="current-photo-container mb-2">
            <div class="current-photo" id="currentPhotoPreview" onclick="document.getElementById('profilePhoto').click()">
              ${this.authService.currentUserValue?.profilePhotoUrl ? 
                `<img src="${this.authService.currentUserValue?.profilePhotoUrl}" alt="Current Profile">` : 
                `<div class="avatar-preview">${this.authService.currentUserValue?.firstName?.charAt(0) || ''}${this.authService.currentUserValue?.lastName?.charAt(0) || ''}</div>`
              }
              <div class="photo-edit-overlay">
                <i class="bi bi-camera-fill"></i>
              </div>
            </div>
            <div class="photo-instructions">Cliquez sur la photo pour modifier</div>
          </div>
          <div class="mb-3" style="display: none;">
            <input type="file" class="form-control" id="profilePhoto" accept="image/*" onchange="handleImageSelection(event)">
          </div>
          <div id="cropContainer" style="display: none;" class="crop-container">
            <div class="crop-header">Recadrer la photo</div>
            <div class="crop-area" id="cropArea">
              <canvas id="cropCanvas"></canvas>
              <div id="cropOverlay" class="crop-overlay"></div>
            </div>
            <div class="crop-controls mt-2">
              <button id="rotateLeftBtn" class="crop-btn" title="Tourner à gauche">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button id="zoomOutBtn" class="crop-btn" title="Zoom arrière">
                <i class="bi bi-dash-circle"></i>
              </button>
              <button id="zoomInBtn" class="crop-btn" title="Zoom avant">
                <i class="bi bi-plus-circle"></i>
              </button>
              <button id="rotateRightBtn" class="crop-btn" title="Tourner à droite">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
            <div class="crop-actions mt-2">
              <button id="cancelCropBtn" class="btn btn-sm btn-light">Annuler</button>
              <button id="applyCropBtn" class="btn btn-sm btn-primary">Appliquer</button>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      },
      didOpen: () => {
        // Add script and style for cropping (see reclamation-back.component.ts for full logic)
        // ... (omitted for brevity, copy the script and style logic from reclamation-back.component.ts)
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const profilePhotoInput = document.getElementById('profilePhoto') as HTMLInputElement;
        const profilePhoto = profilePhotoInput.files ? profilePhotoInput.files[0] : null;
        const currentUser = this.authService.currentUserValue;
        if (profilePhoto && currentUser && currentUser.id) {
          this.userService.uploadProfilePhoto(currentUser.id, profilePhoto).subscribe({
            next: (photoUrl) => {
              if (photoUrl) {
                this.userProfilePhotos.set(currentUser.id, photoUrl);
                currentUser.profilePhotoUrl = photoUrl;
                localStorage.setItem(`profilePhoto_${currentUser.id}`, photoUrl);
                this.authService.updateCurrentUser(currentUser);
                Swal.fire({
                  icon: 'success',
                  title: 'Profil mis à jour',
                  showConfirmButton: false,
                  timer: 1500
                });
              }
            },
            error: () => {
              Swal.fire({
                icon: 'error',
                title: 'Erreur lors de la mise à jour du profil',
                showConfirmButton: false,
                timer: 2000
              });
            }
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Profil mis à jour',
            showConfirmButton: false,
            timer: 1500
          });
        }
      }
    });
  }

  openAccountSettings(): void {
    Swal.fire('Account Settings', 'Account settings functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }

  getSupport(): void {
    Swal.fire('Support', 'Support functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }

  logout(): void {
    this.authService.logout();
  }
} 