import { Component, OnInit, Renderer2, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../login/AuthService';
import { PlanningService } from './services/planning.service';
import { PlanningResponse, PlanningGenerationRequest } from './models/planning.model';
import { formatDate } from '@angular/common';


@Component({
  selector: 'app-planning',
  templateUrl: './planning.component.html',
  styleUrls: ['./planning.component.css']
})
export class PlanningComponent implements OnInit {
  
  planningEntries: PlanningResponse[] = [];
  loading = false;
  error = '';
  success = '';
  isManager = false;
  currentUserId = 0;
  startDate: string = '';
  endDate: string = '';
  selectedUserId?: number;
  showGenerationForm = false;
  generationStartDate: string = '';
  generationEndDate: string = '';
  isMobileMenuOpen: boolean = false;

  @ViewChild('navmenu') navMenu!: ElementRef;
  @ViewChild('mobileNavToggle') mobileNavToggle!: ElementRef;

  constructor(
    private authService: AuthService,
    private planningService: PlanningService,
    private router: Router,
    private renderer: Renderer2
  ) { 
    // Close mobile menu when clicking outside
    this.renderer.listen('window', 'click', (e: Event) => {
      if (
        this.isMobileMenuOpen && 
        this.navMenu && 
        !this.navMenu.nativeElement.contains(e.target) &&
        this.mobileNavToggle && 
        !this.mobileNavToggle.nativeElement.contains(e.target)
      ) {
        this.closeMobileMenu();
      }
    });
  }

  ngOnInit(): void {
    // Set default date range to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.startDate = formatDate(firstDay, 'yyyy-MM-dd', 'en');
    this.endDate = formatDate(lastDay, 'yyyy-MM-dd', 'en');
    this.generationStartDate = this.startDate;
    this.generationEndDate = this.endDate;
    
    // Subscribe to auth changes to ensure we have user data before loading
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.isManager = this.authService.isManager();
        this.currentUserId = user.id;
        
        // Log authentication state to help diagnose issues
        console.log('Auth state updated:', { 
          isLoggedIn: this.authService.isLoggedIn(),
          isManager: this.isManager, 
          currentUser: user,
          userId: this.currentUserId 
        });
        
        // Only load planning when we have a valid user ID
        if (this.currentUserId > 0) {
          this.loadPlanning();
        }
      }
    });

    // Initialize mobile menu close on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });
  }

  // Toggle mobile menu
  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (this.navMenu) {
      if (this.isMobileMenuOpen) {
        this.renderer.addClass(this.navMenu.nativeElement, 'active');
      } else {
        this.renderer.removeClass(this.navMenu.nativeElement, 'active');
      }
    }
  }
  
  // Close mobile menu
  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    if (this.navMenu) {
      this.renderer.removeClass(this.navMenu.nativeElement, 'active');
    }
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  loadPlanning(): void {
    this.loading = true;
    this.error = '';
    
    // Safety check to ensure we have a valid user
    if (this.currentUserId <= 0 && !this.isManager) {
      this.error = 'Utilisateur non identifié. Veuillez vous reconnecter.';
      this.loading = false;
      return;
    }
    
    try {
      if (this.isManager && this.selectedUserId) {
        // Load planning for specific user (manager view)
        this.planningService.getUserPlanning(this.selectedUserId, this.startDate, this.endDate)
          .subscribe({
            next: (data) => {
              this.planningEntries = data;
              this.loading = false;
            },
            error: (err) => {
              console.error('Planning service error:', err);
              this.handleServiceError(err);
            }
          });
      } else if (this.isManager && !this.selectedUserId) {
        // Load all planning entries (manager view)
        this.planningService.getAllPlanning(this.startDate, this.endDate)
          .subscribe({
            next: (data) => {
              this.planningEntries = data;
              this.loading = false;
            },
            error: (err) => {
              console.error('Planning service error:', err);
              this.handleServiceError(err);
            }
          });
      } else if (this.currentUserId > 0) {
        // Load planning for current user (regular user view)
        this.planningService.getUserPlanning(this.currentUserId, this.startDate, this.endDate)
          .subscribe({
            next: (data) => {
              this.planningEntries = data;
              this.loading = false;
            },
            error: (err) => {
              console.error('Planning service error:', err);
              this.handleServiceError(err);
            }
          });
      } else {
        // Fallback - show empty data with informative message
        this.planningEntries = [];
        this.error = 'Impossible de charger les données, veuillez vérifier que le service de planning est démarré.';
        this.loading = false;
      }
    } catch (err) {
      console.error('Exception in loadPlanning:', err);
      this.error = 'Erreur lors de la communication avec le service de planning';
      this.loading = false;
    }
  }
  
  updateDateRange(): void {
    this.loadPlanning();
  }
  
  generatePlanning(): void {
    this.loading = true;
    this.error = '';
    
    const request: PlanningGenerationRequest = {
      startDate: this.generationStartDate,
      endDate: this.generationEndDate,
      userId: this.selectedUserId
    };
    
    this.planningService.generatePlanning(request)
      .subscribe({
        next: (data) => {
          this.success = `${data.length} entrées de planning ont été générées avec succès.`;
          this.loading = false;
          this.loadPlanning(); // Reload planning data
          this.showGenerationForm = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la génération du planning: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
  }
  
  generateAutomaticPlanning(): void {
    this.loading = true;
    this.error = '';
    
    const userId = this.selectedUserId || this.currentUserId;
    
    this.planningService.generateAutomaticPlanning(userId, this.generationStartDate, this.generationEndDate)
      .subscribe({
        next: (data) => {
          this.success = `${data.length} entrées de planning ont été générées automatiquement avec succès.`;
          this.loading = false;
          this.loadPlanning(); // Reload planning data
          this.showGenerationForm = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la génération automatique du planning: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
  }
  
  updatePlanningStatus(id: number, newStatus: string): void {
    this.loading = true;
    this.error = '';
    
    this.planningService.updatePlanningStatus(id, newStatus)
      .subscribe({
        next: () => {
          this.success = 'Statut du planning mis à jour avec succès.';
          this.loading = false;
          this.loadPlanning(); // Reload planning data
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour du statut: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
  }
  
  deletePlanningEntry(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée de planning?')) {
      this.loading = true;
      this.error = '';
      
      this.planningService.deletePlanning(id)
        .subscribe({
          next: () => {
            this.success = 'Entrée de planning supprimée avec succès.';
            this.loading = false;
            this.loadPlanning(); // Reload planning data
          },
          error: (err) => {
            this.error = 'Erreur lors de la suppression: ' + (err.error?.message || err.message);
            this.loading = false;
          }
        });
    }
  }
  
  toggleGenerationForm(): void {
    this.showGenerationForm = !this.showGenerationForm;
  }

  /**
   * Handle HTTP errors from planning service
   */
  private handleServiceError(err: any): void {
    this.loading = false;
    if (err.status === 401) {
      this.error = 'Session expirée. Veuillez vous reconnecter.';
      this.logout();
    } else if (err.status === 0) {
      this.error = 'Serveur inaccessible. Vérifiez votre connexion.';
    } else {
      this.error = `Erreur du service de planning (${err.status}): ${err.error?.message || err.message || 'Erreur inconnue'}`;
    }
  }
  
  /**
   * Determines if a planning entry is a teletravail entry
   * A planning entry is considered a teletravail entry if:
   * - It has a location of 'Domicile' or contains a country/city location
   * - It has a workType of 'Regular' or 'Exceptional'
   */
  isTeletravailEntry(entry: PlanningResponse): boolean {
    return entry.workType === 'Regular' || entry.workType === 'Exceptional';
  }

  canCreateTeletravail(entry: PlanningResponse): boolean {
    // Check if it's not already a teletravail entry
    if (this.isTeletravailEntry(entry)) {
      return false;
    }
    
    // Parse the planning date
    const planningDate = new Date(entry.planningDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if the planning date is in the future or today
    const isValidDate = planningDate >= today;
    
    // Only allow creating teletravail requests for future dates
    return isValidDate;
  }

  /**
   * Statistics Methods
   */
  getTeletravailCount(): number {
    return this.planningEntries.filter(entry => 
      this.isTeletravailEntry(entry)
    ).length;
  }

  getApprovedCount(): number {
    return this.planningEntries.filter(entry => 
      entry.planningStatus === 'APPROVED'
    ).length;
  }

  getPendingCount(): number {
    return this.planningEntries.filter(entry => 
      entry.planningStatus === 'PLANNED'
    ).length;
  }
}