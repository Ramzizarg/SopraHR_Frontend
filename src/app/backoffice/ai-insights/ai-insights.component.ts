import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { AIDecisionService, AIAnalysis, AIRecommendations, RealtimeData } from '../../services/ai-decision.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../login/AuthService';
import { UserService } from '../users/user.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { ContactService } from '../../services/contact.service';

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
export class AIInsightsComponent implements OnInit, OnDestroy, AfterViewInit {
  // Sidebar and UI states
  isSidebarOpen: boolean = true;
  isProfileDropdownOpen: boolean = false;
  searchTerm: string = '';
  userProfilePhotos: Map<number, string | null> = new Map(); // Store user profile photos by userId

  @ViewChild('profileElement') profileElement!: ElementRef;
  @ViewChild('occupancySparkline') occupancySparkline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('teleworkSparkline') teleworkSparkline!: ElementRef<HTMLCanvasElement>;

  profile: any = null; // --- Added for user profile ---
  aiAnalysis: AIAnalysis | null = null;
  recommendations: AIRecommendations | null = null;
  realtimeData: RealtimeData | null = null;
  loading = true;
  error = false;
  lastUpdated: string = '';
  private loadingTimeout: any = null;
  private minLoaderTimer: any = null;
  private minLoaderDone: boolean = false;

  private refreshSubscription: Subscription | null = null;
  private realtimeSubscription: Subscription | null = null;

  // --- Telework week navigation state ---
  currentWeekStart: Date | null = null;

  get criticalAlertsCount(): number {
    const resAlerts = this.aiAnalysis?.reservation_analysis?.alerts || [];
    const teleworkAlerts = this.aiAnalysis?.telework_analysis?.alerts || [];
    return [...resAlerts, ...teleworkAlerts].filter((a: any) => {
      const level = (a.type || a.severity || '').toUpperCase();
      return level === 'CRITICAL';
    }).length;
  }

  constructor(
    private aiService: AIDecisionService,
    public authService: AuthService,
    private userService: UserService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private contactService: ContactService
  ) { }

  ngAfterViewInit(): void {
    this.drawSparklines();
  }

  ngOnInit(): void {
    // Initialize dates (if needed for this component)
    // const today = new Date();
    // const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
    // const startOfWeek = new Date(today);
    // startOfWeek.setDate(today.getDate() + diff);
    // const endOfWeek = new Date(startOfWeek);
    // endOfWeek.setDate(startOfWeek.getDate() + 4);
    // this.startDate = startOfWeek.toISOString().split('T')[0];
    // this.endDate = endOfWeek.toISOString().split('T')[0];

    // Check if there's a stored profile photo URL in localStorage
    this.loadStoredProfilePhoto();
    // Fetch the current user's profile photo
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }
    // Initialize sidebar state
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);
    this.loading = true;
    this.error = false;
    this.minLoaderDone = false;
    if (this.minLoaderTimer) {
      clearTimeout(this.minLoaderTimer);
    }
    // Always show loader for at least 5s
    this.minLoaderTimer = setTimeout(() => {
      this.minLoaderDone = true;
      // If data is loaded, hide loader
      if (!this.loading) {
        this.loading = false;
      }
    }, 5000);
    this.loadData();
  }

  // Call drawSparklines when data updates
  ngOnChanges(): void {
    this.drawSparklines();
  }

  loadData(): void {
    this.loading = true;
    this.error = false;
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    // Set a timeout to show error after 5s if still loading
    this.loadingTimeout = setTimeout(() => {
      if (this.loading && this.minLoaderDone) {
        this.error = true;
        this.loading = false;
      }
    }, 5000);

    // Load current analysis
    this.aiService.getCurrentAnalysis().subscribe({
      next: (data) => {
        this.aiAnalysis = data.analysis;
        this.lastUpdated = new Date().toLocaleString();
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
        // Wait for min loader duration
        if (this.minLoaderDone) {
          this.loading = false;
        } else {
          // Wait for timer to finish
          const wait = () => {
            if (this.minLoaderDone) {
        this.loading = false;
            } else {
              setTimeout(wait, 100);
            }
          };
          wait();
        }
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
        }
        setTimeout(() => this.drawSparklines(), 100);
      },
      error: (err) => {
        console.error('Error loading AI analysis:', err);
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
        }
        // Wait for min loader duration before showing error
        const showError = () => {
          if (this.minLoaderDone) {
            this.loading = false;
        this.error = true;
          } else {
            setTimeout(showError, 100);
          }
        };
        showError();
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
    this.error = false;
    this.loading = true;
    this.minLoaderDone = false;
    if (this.minLoaderTimer) {
      clearTimeout(this.minLoaderTimer);
    }
    this.minLoaderTimer = setTimeout(() => {
      this.minLoaderDone = true;
      if (!this.loading) {
        this.loading = false;
      }
    }, 5000);
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.loadingTimeout = setTimeout(() => {
      if (this.loading && this.minLoaderDone) {
        this.error = true;
        this.loading = false;
      }
    }, 5000);
    this.aiService.refreshAnalysis().subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
        }
        const showError = () => {
          if (this.minLoaderDone) {
            this.loading = false;
        this.error = true;
          } else {
            setTimeout(showError, 100);
          }
        };
        showError();
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

  /**
   * Load stored profile photo from localStorage
   */
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

  /**
   * Fetch profile photo for a specific user and store it in the userProfilePhotos map
   * @param userId The ID of the user
   */
  fetchUserProfilePhoto(userId: number): void {
    this.userService.getUserProfilePhoto(userId).subscribe({
      next: (photoUrl) => {
        if (photoUrl) {
          this.userProfilePhotos.set(userId, photoUrl);
          // If this is the current user, also update their profile in the auth service
          if (this.authService.currentUserValue?.id === userId) {
            this.authService.currentUserValue.profilePhotoUrl = photoUrl;
            // Store in localStorage for persistence
            localStorage.setItem(`profilePhoto_${userId}`, photoUrl);
            // Force UI update
            this.authService.updateCurrentUser(this.authService.currentUserValue);
          }
        }
      },
      error: (error) => {
        console.error('Error fetching profile photo for user', userId, error);
      }
    });
  }

  /**
   * Get profile photo URL for a specific user
   * @param userId The ID of the user
   * @returns The profile photo URL or null if not available
   */
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
        // Add script to handle image selection, preview, and cropping
        const script = document.createElement('script');
        script.textContent = `
          // Global variables for cropping
          let originalImage = null;
          let croppedImage = null;
          let cropCanvas = null;
          let cropContext = null;
          let scale = 1;
          let rotation = 0;
          let dragStartX = 0;
          let dragStartY = 0;
          let imgX = 0;
          let imgY = 0;
          let dragging = false;
          const cropSize = 200; // Size of the crop area
          // ... (rest of cropping script from reclamation-back.component.ts)
        `;
        document.body.appendChild(script);
        // Add style for the preview elements and cropping interface
        const style = document.createElement('style');
        style.textContent = `
          .profile-edit-container { padding: 0.5rem 0.5rem 0; }
          .current-photo-container { display: flex; flex-direction: column; align-items: center; }
          .current-photo { width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin-bottom: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; transition: all 0.2s ease; }
          .current-photo:hover { box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15); }
          .current-photo:hover .photo-edit-overlay { opacity: 1; }
          .current-photo img { width: 100%; height: 100%; object-fit: cover; }
          .avatar-preview { width: 100%; height: 100%; background-color: #3B82F6; color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 500; }
          .photo-edit-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease; }
          .photo-edit-overlay i { color: white; font-size: 1.5rem; }
          .photo-instructions { font-size: 0.8rem; color: #6B7280; margin-bottom: 1rem; text-align: center; }
          .crop-container { display: none; flex-direction: column; align-items: center; max-width: 100%; margin: 0 auto; }
          .crop-header { font-size: 14px; font-weight: 500; color: #4B5563; margin-bottom: 8px; text-align: center; }
          .crop-area { position: relative; width: 200px; height: 200px; border-radius: 50%; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); margin: 0 auto; }
          #cropCanvas { width: 100%; height: 100%; display: block; cursor: move; touch-action: none; }
          .crop-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 2px dashed rgba(255, 255, 255, 0.8); border-radius: 50%; box-sizing: border-box; pointer-events: none; }
          .crop-controls { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
          .crop-btn { width: 36px; height: 36px; border-radius: 50%; background-color: #F3F4F6; border: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; }
          .crop-btn:hover { background-color: #E5E7EB; }
          .crop-btn i { font-size: 16px; color: #4B5563; }
          .crop-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
          .crop-actions .btn { font-size: 12px; padding: 4px 12px; }
        `;
        document.head.appendChild(style);
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
    this.router.navigate(['/login']);
  }

  openRevaAiInfo(): void {
    Swal.fire({
      title: '<span style="color:#2563EB;font-weight:700;">Reva AI</span> – Your Smart Workspace Assistant',
      html: `
        <div style="text-align:left;font-size:1.08rem;line-height:1.7;">
          <b>Reva AI</b> is your intelligent assistant for workspace optimization, telework management, and smart recommendations.<br><br>
          <ul style="margin-left:1.2em;">
            <li><b>Real-time Analytics:</b> Get instant insights on workspace occupancy, telework rates, and trends.</li>
            <li><b>AI Recommendations:</b> Receive actionable suggestions to optimize desk usage and telework planning.</li>
            <li><b>Critical Alerts:</b> Be notified of anomalies, over-occupancy, or under-utilization.</li>
            <li><b>Smart Summaries:</b> Understand your workspace at a glance with intelligent summaries and visualizations.</li>
            <li><b>Seamless Integration:</b> Works with your existing reservation and telework systems.</li>
          </ul>
          <br>
          <b>Why Reva AI?</b><br>
          <span style="color:#2563EB;">Empower your organization</span> to make data-driven decisions, improve employee satisfaction, and maximize office efficiency.<br><br>
          <i class="bi bi-robot" style="font-size:2rem;color:#2563EB;"></i>
        </div>
      `,
      confirmButtonText: 'Got it!',
      customClass: {
        popup: 'modern-toast-popup',
        confirmButton: 'hero-btn main',
      },
      width: 640,
      padding: '2.2em 1.5em 1.5em 1.5em',
      background: '#fff',
      showCloseButton: true,
      focusConfirm: false,
      position: 'center',
      didOpen: (el) => {
        if (el.parentElement) {
          el.parentElement.style.justifyContent = 'flex-end';
          el.parentElement.style.alignItems = 'center';
          // Removed marginRight
        }
      }
    });
  }

  openContactItPopup(): void {
    Swal.fire({
      title: `<div style='display:flex;align-items:center;gap:0.7rem;justify-content:center;'>
        <i class='bi bi-robot' style='font-size:2.2rem;color:#2563EB;filter:drop-shadow(0 0 8px #2563eb55);'></i>
        <span style='color:#2563EB;font-weight:700;font-size:1.35rem;'>Contact IT Support</span>
      </div>`,
      html: `
        <div style='background:linear-gradient(90deg,#2563EB11 0%,#3B82F622 100%);padding:1.1em 1em 0.7em 1em;border-radius:1.2em 1.2em 0 0;margin:-1.5em -1.5em 1.2em -1.5em;'>
          <div style='font-size:1.08rem;color:#2563EB;font-weight:600;text-align:center;'>Describe your problem</div>
        </div>
        <form id='it-contact-form' style='text-align:left;'>
          <textarea id='it-message' class='swal2-textarea' rows='5' placeholder='Explain your issue in detail...' style='resize:vertical;border-radius:1em;font-size:1.08rem;box-shadow:0 2px 8px #2563eb11;width:22em;height:10em;'></textarea>
        </form>
      `,
      showCancelButton: true,
      confirmButtonText: 'Send',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        const message = (document.getElementById('it-message') as HTMLTextAreaElement)?.value;
        if (!message) {
          Swal.showValidationMessage('Please enter a message.');
          return false;
        }
        return { message };
      },
      customClass: {
        popup: 'modern-toast-popup',
        confirmButton: 'hero-btn main',
        cancelButton: 'hero-btn alt',
      },
      width: 480,
      background: '#fff',
      showCloseButton: true,
      padding: '0 0 2em 0',
      didOpen: (el) => {
        const popup = el.querySelector('.swal2-popup');
        if (popup && popup instanceof HTMLElement) {
          popup.style.borderRadius = '1.5em';
        }
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { message } = result.value;
        this.contactService.createContactRequest({
          userEmail: 'anonymous@ai-insights.com',
          employeeName: 'AI Insights User',
          subject: 'IT Support Request',
          message,
          priority: 'HIGH'
        }).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Message sent!',
              text: 'Your request has been sent to IT support. They will contact you soon.',
              confirmButtonText: 'OK',
              customClass: { confirmButton: 'hero-btn main' },
              width: 380
            });
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'There was a problem sending your request. Please try again later.',
              confirmButtonText: 'OK',
              customClass: { confirmButton: 'hero-btn main' },
              width: 380
            });
          }
        });
      }
    });
  }

  drawSparklines(): void {
    // Occupancy sparkline
    if (this.occupancySparkline && this.aiAnalysis?.reservation_analysis) {
      const ctx = this.occupancySparkline.nativeElement.getContext('2d');
      if (ctx) {
        // Use current_occupancy for the last 7 days (since daily occupancy is not available)
        let data: number[] = [];
        if (this.aiAnalysis.telework_analysis?.daily_percentages) {
          data = this.aiAnalysis.telework_analysis.daily_percentages.slice(-7).map(() => this.aiAnalysis?.reservation_analysis?.current_occupancy || 0);
        }
        this.drawSparkline(ctx, data, '#2563eb');
      }
    }
    // Telework sparkline
    if (this.teleworkSparkline && this.aiAnalysis?.telework_analysis) {
      const ctx = this.teleworkSparkline.nativeElement.getContext('2d');
      if (ctx) {
        let data: number[] = [];
        if (this.aiAnalysis.telework_analysis.daily_percentages) {
          data = this.aiAnalysis.telework_analysis.daily_percentages.slice(-7).map(d => d.percentage);
        }
        this.drawSparkline(ctx, data, '#0284c7');
      }
    }
  }

  drawSparkline(ctx: CanvasRenderingContext2D, data: number[], color: string) {
    const w = 60, h = 18;
    ctx.clearRect(0, 0, w, h);
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    if (!data.length) return;
    const min = Math.min(...data), max = Math.max(...data);
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((val - min) / (max - min || 1)) * (h - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Optionally, draw a small dot at the last value
    ctx.beginPath();
    const lastX = ((data.length - 1) / (data.length - 1)) * (w - 2) + 1;
    const lastY = h - 2 - ((data[data.length - 1] - min) / (max - min || 1)) * (h - 4);
    ctx.arc(lastX, lastY, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
} 