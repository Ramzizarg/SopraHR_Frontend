import { Component, OnInit, AfterViewChecked, Renderer2, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../login/AuthService';
import { PlanningService } from './services/planning.service';
import { PlanningResponse, TeletravailRequest } from './models/planning.model';
import { formatDate } from '@angular/common';
import Swal from 'sweetalert2';
declare var bootstrap: any; // Bootstrap JS declaration


@Component({
  selector: 'app-planning',
  templateUrl: './planning.component.html',
  styleUrls: ['./planning.component.css', '../shared/header-footer.css']
})
export class PlanningComponent implements OnInit, AfterViewChecked {
  
  planningEntries: PlanningResponse[] = [];
  originalPlanningEntries: PlanningResponse[] = []; // Store unfiltered entries
  teamMembers: any[] = []; // Store all team members
  loading = false;
  error = '';
  success = '';
  isManager = false;
  isTeamLeader = false;
  currentUserId = 0;
  currentTeamId?: number;
  currentTeamName?: string;
  startDate: string = '';
  endDate: string = '';
  selectedUserId?: number;
  isMobileMenuOpen: boolean = false;
  showOnlyTeletravail: boolean = false;
  showOnlyCurrentUser: boolean = false;
  showAllUsers: boolean = false; // For managers to view all users
  showTeamLeadersOnly: boolean = false; // For managers to filter to team leaders only
  isContactModalOpen: boolean = false; // For contact modal

  @ViewChild('navmenu') navMenu!: ElementRef;
  @ViewChild('mobileNavToggle') mobileNavToggle!: ElementRef;

  // Note: toggleMobileMenu and logout functions are already defined elsewhere in this component

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

  // Week navigation flags
  isCurrentWeek: boolean = true;
  isNextWeek: boolean = false;
  
  /**
   * Set dates to current work week (Monday-Friday)
   */
  setCurrentWeekDates(): void {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    // Calculate the Monday of current week
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Handle Sunday specially
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    // Calculate the Friday of current week
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // 4 days after Monday = Friday
    
    this.startDate = formatDate(monday, 'yyyy-MM-dd', 'en');
    this.endDate = formatDate(friday, 'yyyy-MM-dd', 'en');
    
    // Set navigation flags
    this.isCurrentWeek = true;
    this.isNextWeek = false;
    
    console.log('Current week dates set:', { start: this.startDate, end: this.endDate });
  }
  
  ngOnInit(): void {
    // Set default date range to current week (Monday to Friday of this week)
    this.setCurrentWeekDates();
    
    // Log the start and end dates for debugging
    console.log('Start date:', this.startDate);
    console.log('End date:', this.endDate);
    
    // Subscribe to auth changes to ensure we have user data before loading
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.isManager = this.authService.isManager();
        this.isTeamLeader = this.authService.isTeamLeader();
        this.currentUserId = user.id;
        
        // For managers, enable showAllUsers by default
        if (this.isManager) {
          this.showAllUsers = true;
        }
        
        // Get team information if available
        if (user.team) {
          this.currentTeamName = user.team;
          // Extract team ID from team name if needed
          // This might need to be adapted based on how team info is stored
          this.currentTeamId = this.getTeamIdFromName(user.team);
        }
        
        // Log authentication state to help diagnose issues
        console.log('Auth state updated:', { 
          isLoggedIn: this.authService.isLoggedIn(),
          isManager: this.isManager,
          isTeamLeader: this.isTeamLeader,
          currentUser: user,
          userId: this.currentUserId,
          teamId: this.currentTeamId,
          teamName: this.currentTeamName
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
    
    // Add or remove no-scroll class to body
    if (this.isMobileMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
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
  
  /**
   * Toggle showing team leaders only (manager view)
   */
  toggleTeamLeadersOnly(): void {
    // We need to maintain showAllUsers=true since that's the base manager view
    // showTeamLeadersOnly is just a filter on top of all users
    
    // Reset current user filter if needed
    if (this.showTeamLeadersOnly) {
      this.showOnlyCurrentUser = false;
    }
    
    // Reload planning with the filter parameter
    this.loadPlanning();
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Open the contact modal
   */
  openContactModal(): void {
    this.isContactModalOpen = true;
    document.body.classList.add('modal-open');
  }

  /**
   * Close the contact modal
   */
  closeContactModal(): void {
    this.isContactModalOpen = false;
    document.body.classList.remove('modal-open');
  }

  /**
   * Send contact message
   */
  sendContactMessage(): void {
    alert('Votre message a été envoyé. Nous vous contacterons bientôt.');
    this.closeContactModal();
  }
  
  /**
   * Helper method to get team ID from team name 
   */
  getTeamIdFromName(teamName: string): number {
    // Map team names to IDs based on the system's team configuration
    const teamMap: {[key: string]: number} = {
      'DEV': 1,
      'QA': 2,
      'OPS': 3,
      'RH': 4
    };
    
    return teamMap[teamName] || 0;
  }
  
  loadPlanning(): void {
    this.loading = true;
    this.error = '';
    
    // Safety check to ensure we have a valid user
    if (this.currentUserId <= 0 && !this.isManager && !this.isTeamLeader) {
      this.error = 'Utilisateur non identifié. Veuillez vous reconnecter.';
      this.loading = false;
      return;
    }
    
    try {
      if (this.isManager) {
        // Managers now always see all users by default (showAllUsers is true by default)
        console.log('Manager view - loading all users');
        
        // First, load all users from the system
        this.planningService.getAllUsers()
          .subscribe({
            next: (users) => {
              console.log('Loaded all users:', users);
              // Filter to only team leaders if that toggle is active
              if (this.showTeamLeadersOnly) {
                console.log('Filtering to show only team leaders');
                this.teamMembers = users.filter(user => user.roles?.includes('TEAM_LEADER'));
                this.success = 'Affichage filtré: chefs d\'équipe uniquement';
              } else {
                this.teamMembers = users;
              }
              
              this.updateUniqueEmployees(); // Update unique employees with filtered users
              
              // Now load all planning entries across the system
              this.planningService.getAllPlanning(this.startDate, this.endDate)
                .subscribe({
                  next: (data) => {
                    this.originalPlanningEntries = [...data]; // Store original data
                    this.planningEntries = this.showOnlyTeletravail ? 
                      this.filterTeletravailOnly(data) : data;
                    this.loading = false;
                    if (this.showTeamLeadersOnly) {
                      this.success = 'Affichage uniquement des chefs d\'équipe';
                    } else {
                      this.success = 'Affichage de tous les utilisateurs';
                    }
                  },
                  error: (err: any) => {
                    console.error('Planning service error:', err);
                    this.handleServiceError(err);
                  }
                });
            },
            error: (err) => {
              console.error('Error loading all users:', err);
              this.handleServiceError(err);
            }
          });
      } else if (this.currentTeamName) {
        // Load team members for any user with a team, not just team leaders
        console.log('User has team, current team name:', this.currentTeamName);
        // Make sure the team name is one of the valid enum values: DEV, QA, OPS, RH
        const normalizedTeamName = this.currentTeamName.toUpperCase();
        console.log('Using normalized team name for API call:', normalizedTeamName);
        
        // First, load all team members to ensure they're displayed even without teletravail entries
        this.planningService.getTeamMembers(normalizedTeamName)
          .subscribe({
            next: (members) => {
              console.log('Loaded team members:', members);
              this.teamMembers = members;
              this.updateUniqueEmployees(); // Update unique employees when team members change
              
              // Then load planning for the team using team name directly (team leader view)
              this.planningService.getTeamPlanning(this.currentTeamName || 'DEFAULT', this.startDate, this.endDate)
                .subscribe({
                  next: (data) => {
                    this.originalPlanningEntries = [...data]; // Store original data
                    this.planningEntries = this.showOnlyTeletravail ? 
                      this.filterTeletravailOnly(data) : data;
                    this.updateUniqueEmployees(); // Update unique employees when planning entries change
                    this.loading = false;
                    this.success = `Planning de l'équipe ${this.currentTeamName} chargé.`;
                  },
                  error: (err: any) => {
                    console.error('Planning service error (team):', err);
                    this.handleServiceError(err);
                    this.loading = false;
                  }
                });
            },
            error: (err: any) => {
              console.error('Error loading team members:', err);
              // Continue loading planning entries even if team member fetch fails
              this.planningService.getTeamPlanning(this.currentTeamName || 'DEFAULT', this.startDate, this.endDate)
                .subscribe({
                  next: (data) => {
                    this.originalPlanningEntries = [...data]; 
                    this.planningEntries = this.showOnlyTeletravail ? 
                      this.filterTeletravailOnly(data) : data;
                    this.updateUniqueEmployees(); // Update unique employees when planning entries change
                    this.loading = false;
                  },
                  error: (err: any) => {
                    console.error('Planning service error (team):', err);
                    this.handleServiceError(err);
                    this.loading = false;
                  }
                });
            }
          });
      } else if (this.currentUserId > 0) {
        // Load planning for current user (regular user view)
        this.planningService.getUserPlanning(this.currentUserId, this.startDate, this.endDate)
          .subscribe({
            next: (data) => {
              this.originalPlanningEntries = [...data]; // Store original data
              this.planningEntries = this.showOnlyTeletravail ? 
                this.filterTeletravailOnly(data) : data;
              this.loading = false;
            },
            error: (err: any) => {
              console.error('Planning service error:', err);
              this.handleServiceError(err);
            }
          });
      } else {
        // Fallback - show empty data with informative message
        this.originalPlanningEntries = [];
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
  
  /**
   * Filter planning entries based on selected filters
   */
  filterEntries(): void {
    // Start with original entries
    let filteredEntries = [...this.originalPlanningEntries];
    
    // Apply current user filter if enabled
    if (this.showOnlyCurrentUser) {
      filteredEntries = filteredEntries.filter(entry => entry.userId === this.currentUserId);
    }
    
    // Apply teletravail filter if enabled (kept for backward compatibility)
    if (this.showOnlyTeletravail) {
      filteredEntries = this.filterTeletravailOnly(filteredEntries);
    }
    
    this.planningEntries = filteredEntries;
    this.updateUniqueEmployees(); // Update unique employees when filter changes
  }
  
  // Old filter method kept for backward compatibility
  filterTeletravailEntries(): void {
    this.filterEntries();
  }
  
  /**
   * Helper method to filter only teletravail entries
   * A teletravail entry is identified by:
   * - Having a workType of Regular or Exceptional
   * - Or having a status of PENDING, APPROVED, or REJECTED (teletravail request statuses)
   */
  private filterTeletravailOnly(entries: PlanningResponse[]): PlanningResponse[] {
    return entries.filter(entry => {
      // Check for teletravail work types
      const isTeletravailType = entry.workType === 'Regular' || entry.workType === 'Exceptional';
      
      // Check for teletravail request statuses
      const isTeletravailStatus = entry.planningStatus === 'PENDING' || 
                              entry.planningStatus === 'APPROVED' || 
                              entry.planningStatus === 'REJECTED';
      
      // Return entries that match either criteria
      return isTeletravailType || isTeletravailStatus;
    });
  }
  
  updateDateRange(): void {
    this.loadPlanning();
  }
  
  // Planning generation methods removed - planning entries are now created directly via teletravail requests
  
  // Status updates are now handled through the teletravail service directly
  // This method is kept for reference but should be updated to use teletravail endpoints if needed
  
  // Method to cancel a teletravail request (which is now equivalent to deleting a planning entry)
  cancelTeletravailRequest(id: number): void {
    // Find the entry to get details for the confirmation message
    const entryToDelete = this.planningEntries.find(entry => entry.id === id);
    if (!entryToDelete) {
      this.error = 'Entrée de télétravail non trouvée.';
      return;
    }
    
    // Create a more informative confirmation message
    const isUserOwned = entryToDelete.userId === this.currentUserId;
    const dateStr = new Date(entryToDelete.planningDate).toLocaleDateString('fr-FR');
    const title = isUserOwned 
      ? 'Annuler votre télétravail' 
      : `Annuler le télétravail pour ${entryToDelete.userName}`;
    const text = isUserOwned
      ? `Voulez-vous annuler votre télétravail prévu le ${dateStr} ?`
      : `Êtes-vous sûr de vouloir annuler l'entrée de télétravail pour ${entryToDelete.userName} le ${dateStr} ?`;
    
    // Use SweetAlert for a more modern and attractive confirmation dialog
    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Non, garder'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.error = '';
        
        // Use the teletravail cancellation endpoint (via planning service wrapper)
        this.planningService.cancelTeletravailRequest(id)
          .subscribe({
            next: () => {
              // Show success message with SweetAlert instead of the basic alert
              const successMsg = isUserOwned
                ? `Votre demande de télétravail du ${dateStr} a été annulée.`
                : `La demande de télétravail pour ${entryToDelete.userName} le ${dateStr} a été annulée.`;
              
              Swal.fire({
                title: 'Succès',
                text: successMsg,
                icon: 'success',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
              this.loadPlanning(); // Reload planning data
            },
            error: (err: any) => {
              let errorMsg = '';
              if (err.status === 403) {
                errorMsg = 'Vous n\'avez pas l\'autorisation d\'annuler cette demande de télétravail.';
              } else {
                errorMsg = 'Erreur lors de l\'annulation: ' + (err.error?.message || err.message);
              }
              
              // Show error with SweetAlert
              Swal.fire({
                title: 'Erreur',
                text: errorMsg,
                icon: 'error',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
            }
          });
      }
    });
  }
  
  // Navigation method to the teletravail request form
  createNewTeletravailRequest(): void {
    this.router.navigate(['/teletravail']);
  }
  
  /**
   * Approve a teletravail request (for team leaders and managers)
   * @param id The ID of the teletravail request to approve
   */
  approveTeletravailRequest(id: number): void {
    // Find the entry to get context for a useful message
    const entryToApprove = this.planningEntries.find(entry => entry.id === id);
    if (!entryToApprove) {
      this.error = 'Demande de télétravail non trouvée';
      return;
    }
    
    // Format date for user-friendly message
    const dateStr = formatDate(new Date(entryToApprove.planningDate), 'dd/MM/yyyy', 'fr');
    
    // Use SweetAlert for confirmation dialog
    Swal.fire({
      title: 'Approuver cette demande ?',
      html: `Voulez-vous approuver la demande de télétravail de <strong>${entryToApprove.userName}</strong> pour le <strong>${dateStr}</strong> ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Oui, approuver',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.error = '';
        
        // Call the service to approve the request
        this.planningService.approveTeletravailRequest(id)
          .subscribe({
            next: () => {
              // Show success message
              Swal.fire({
                title: 'Demande approuvée',
                text: `La demande de télétravail de ${entryToApprove.userName} pour le ${dateStr} a été approuvée.`,
                icon: 'success',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
              this.loadPlanning(); // Reload planning data
            },
            error: (err: any) => {
              let errorMsg = '';
              if (err.status === 403) {
                errorMsg = 'Vous n\'avez pas l\'autorisation d\'approuver cette demande de télétravail.';
              } else {
                errorMsg = 'Erreur lors de l\'approbation: ' + (err.error?.message || err.message);
              }
              
              // Show error with SweetAlert
              Swal.fire({
                title: 'Erreur',
                text: errorMsg,
                icon: 'error',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
            }
          });
      }
    });
  }
  
  /**
   * Reject a teletravail request (for team leaders and managers)
   * @param id The ID of the teletravail request to reject
   */
  rejectTeletravailRequest(id: number): void {
    // Find the entry to get context for a useful message
    const entryToReject = this.planningEntries.find(entry => entry.id === id);
    if (!entryToReject) {
      this.error = 'Demande de télétravail non trouvée';
      return;
    }
    
    // Format date for user-friendly message
    const dateStr = formatDate(new Date(entryToReject.planningDate), 'dd/MM/yyyy', 'fr');
    
    // Use SweetAlert for confirmation dialog with rejection reason input
    Swal.fire({
      title: 'Refuser cette demande ?',
      html: `Voulez-vous refuser la demande de télétravail de <strong>${entryToReject.userName}</strong> pour le <strong>${dateStr}</strong> ?`,
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Motif du refus (obligatoire)',
      inputPlaceholder: 'Veuillez indiquer la raison du refus...',
      inputAttributes: {
        'aria-label': 'Veuillez indiquer la raison du refus'
      },
      inputValidator: (value) => {
        if (!value) {
          return 'Vous devez indiquer une raison pour le refus';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Refuser la demande',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const rejectionReason = result.value;
        this.loading = true;
        this.error = '';
        
        // Call the service to reject the request
        this.planningService.rejectTeletravailRequest(id, rejectionReason)
          .subscribe({
            next: () => {
              // Show success message
              Swal.fire({
                title: 'Demande refusée',
                text: `La demande de télétravail de ${entryToReject.userName} pour le ${dateStr} a été refusée.`,
                icon: 'info',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
              this.loadPlanning(); // Reload planning data
            },
            error: (err: any) => {
              let errorMsg = '';
              if (err.status === 403) {
                errorMsg = 'Vous n\'avez pas l\'autorisation de refuser cette demande de télétravail.';
              } else {
                errorMsg = 'Erreur lors du refus: ' + (err.error?.message || err.message);
              }
              
              // Show error with SweetAlert
              Swal.fire({
                title: 'Erreur',
                text: errorMsg,
                icon: 'error',
                confirmButtonText: 'OK'
              });
              
              this.loading = false;
            }
          });
      }
    });
  }

  /**
   * Handle HTTP errors from teletravail service
   */
  private handleServiceError(err: any): void {
    this.loading = false;
    if (err.status === 401) {
      this.error = 'Session expirée. Veuillez vous reconnecter.';
      this.logout();
    } else if (err.status === 0) {
      this.error = 'Serveur inaccessible. Vérifiez votre connexion.';
    } else {
      this.error = `Erreur du service de télétravail (${err.status}): ${err.error?.message || err.message || 'Erreur inconnue'}`;
    }
  }
  
  /**
   * Show rejection reason in a modal
   * @param rejectionReason The reason for rejection
   */
  showRejectionReason(rejectionReason: string): void {
    Swal.fire({
      title: 'Motif du refus',
      text: rejectionReason,
      icon: 'info',
      confirmButtonText: 'OK'
    });
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
  
  /**
   * Determines if a user can create a teletravail request for the given planning entry
   * A user can create a teletravail request if:
   * - The entry is not already a teletravail entry
   * - The entry date is in the future or today
   */
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
      entry.planningStatus === 'PENDING'
    ).length;
  }
  
  /**
   * Store the unique employees list to avoid repeated calculations
   */
  private _uniqueEmployees: any[] = [];
  
  // Tooltip related properties
  private tooltipsInitialized = false;
  
  // Getter for unique employees (computed property)
  get uniqueEmployees(): any[] {
    return this._uniqueEmployees;
  }

  /**
   * Update the unique employees list when data changes
   * This should be called whenever teamMembers or planningEntries change
   */
  updateUniqueEmployees(): void {
    console.log('Updating unique employees list');
    this._uniqueEmployees = this.calculateUniqueEmployees();
    
    // Initialize tooltips after updating the DOM
    setTimeout(() => this.initializeTooltips(), 100);
  }
  
  /**
   * Initialize Bootstrap tooltips for status icons
   */
  initializeTooltips(): void {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltipTriggerList.length > 0) {
      // Dispose existing tooltips first to prevent duplicates
      tooltipTriggerList.forEach(element => {
        const tooltip = bootstrap.Tooltip.getInstance(element);
        if (tooltip) {
          tooltip.dispose();
        }
      });
      
      // Create new tooltips
      const tooltipList = Array.from(tooltipTriggerList).map(tooltipTriggerEl => {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
          trigger: 'hover',
          boundary: 'window'
        });
      });
      
      this.tooltipsInitialized = true;
    }
  }
  
  /**
   * AfterViewChecked lifecycle hook to initialize tooltips after the view is rendered
   */
  ngAfterViewChecked(): void {
    if (!this.tooltipsInitialized && this._uniqueEmployees.length > 0) {
      this.initializeTooltips();
    }
  }
  
  /**
   * Handle click on status icon for team leaders to manage requests
   * @param event The click event
   * @param userId The user ID of the employee
   * @param day The day that was clicked
   * @param status The current status
   */
  handleStatusClick(event: Event, userId: number, day: Date, status: string): void {
    // Only allow team leaders or managers to change request status
    if (!this.isTeamLeader && !this.isManager) {
      return;
    }
    
    // Prevent click from propagating to parent elements
    event.stopPropagation();
    
    // Find the planning entry matching the user and date
    const dateStr = formatDate(day, 'yyyy-MM-dd', 'en');
    const entry = this.planningEntries.find(entry => 
      entry.userId === userId && 
      formatDate(new Date(entry.planningDate), 'yyyy-MM-dd', 'en') === dateStr
    );
    
    if (!entry || !entry.id) {
      console.error('Cannot find entry for this date and user');
      return;
    }
    
    // Show options based on current status
    if (status === 'PENDING') {
      this.showApprovalOptions(entry.id, entry.employeeName || 'Employé');
    } else if (status === 'TELETRAVAIL') {
      this.showRejectionOptions(entry.id, entry.employeeName || 'Employé');
    }
  }
  
  /**
   * Show a dialog with options to approve or reject a pending request
   * @param requestId The ID of the request
   * @param employeeName The name of the employee
   */
  showApprovalOptions(requestId: number, employeeName: string): void {
    Swal.fire({
      title: 'Gérer la demande',
      html: `Souhaitez-vous approuver ou refuser la demande de télétravail de <strong>${employeeName}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approuver',
      cancelButtonText: 'Refuser',
      showCloseButton: true,
      cancelButtonColor: '#d33',
      confirmButtonColor: '#28a745',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Approve the request
        this.approveRequest(requestId);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Reject the request - ask for reason
        this.promptForRejectionReason(requestId, employeeName);
      }
    });
  }
  
  /**
   * Approve a teletravail request
   * @param requestId The ID of the request to approve
   */
  approveRequest(requestId: number): void {
    this.loading = true;
    this.planningService.approveTeletravailRequest(requestId).subscribe({
      next: (response) => {
        this.success = 'Demande approuvée avec succès';
        this.loading = false;
        // Reload the planning data
        this.loadPlanning();
        
        // Show success notification
        Swal.fire({
          title: 'Demande approuvée',
          text: 'La demande de télétravail a été approuvée avec succès',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error approving request:', error);
        this.error = 'Erreur lors de l\'approbation de la demande';
        this.loading = false;
      }
    });
  }
  
  /**
   * Prompt for rejection reason when rejecting a request
   * @param requestId The ID of the request to reject
   * @param employeeName The name of the employee
   */
  promptForRejectionReason(requestId: number, employeeName: string): void {
    Swal.fire({
      title: 'Motif de refus',
      html: `Veuillez indiquer le motif de refus pour la demande de <strong>${employeeName}</strong>:`,
      input: 'textarea',
      inputPlaceholder: 'Motif de refus...',
      inputAttributes: {
        'aria-label': 'Motif de refus'
      },
      showCancelButton: true,
      confirmButtonText: 'Refuser la demande',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      inputValidator: (value) => {
        if (!value) {
          return 'Vous devez indiquer un motif de refus';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        // Reject the request with the provided reason
        this.rejectRequest(requestId, result.value);
      }
    });
  }
  
  /**
   * Reject a teletravail request
   * @param requestId The ID of the request to reject
   * @param rejectionReason The reason for rejection
   */
  rejectRequest(requestId: number, rejectionReason: string): void {
    this.loading = true;
    this.planningService.rejectTeletravailRequest(requestId, rejectionReason).subscribe({
      next: (response) => {
        this.success = 'Demande refusée avec succès';
        this.loading = false;
        // Reload the planning data
        this.loadPlanning();
        
        // Show success notification
        Swal.fire({
          title: 'Demande refusée',
          text: 'La demande de télétravail a été refusée avec succès',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
        this.error = 'Erreur lors du refus de la demande';
        this.loading = false;
      }
    });
  }
  
  /**
   * Show a dialog with options to reject an approved request
   * @param requestId The ID of the request
   * @param employeeName The name of the employee
   */
  showRejectionOptions(requestId: number, employeeName: string): void {
    Swal.fire({
      title: 'Annuler l\'approbation',
      html: `Souhaitez-vous annuler l'approbation de télétravail de <strong>${employeeName}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Non, conserver',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        // Ask for rejection reason
        this.promptForRejectionReason(requestId, employeeName);
      }
    });
  }

  /**
   * Calculate unique employees from planning entries
   * This is used to display one row per employee in the calendar view
   * Always show all team members regardless of whether they have entries for this week
   */
  private calculateUniqueEmployees(): any[] {
    // Use a Map with userId as key to get unique employees
    const employeeMap = new Map();
    
    // If showing only current user, just add the current user
    if (this.showOnlyCurrentUser && this.currentUserId) {
      // Find current user from team members or planning entries
      const currentUserFromTeam = this.teamMembers.find(member => member.id === this.currentUserId);
      const currentUserFromPlanning = this.planningEntries.find(entry => entry.userId === this.currentUserId);
      
      if (currentUserFromTeam) {
        employeeMap.set(this.currentUserId, {
          userId: this.currentUserId,
          userName: currentUserFromTeam.employeeName || 
                   (currentUserFromTeam.firstName + ' ' + currentUserFromTeam.lastName),
          employeeName: currentUserFromTeam.employeeName || 
                      (currentUserFromTeam.firstName + ' ' + currentUserFromTeam.lastName),
          team: currentUserFromTeam.team,
          role: currentUserFromTeam.role || 'EMPLOYEE'
        });
      } else if (currentUserFromPlanning) {
        employeeMap.set(this.currentUserId, {
          userId: this.currentUserId,
          userName: currentUserFromPlanning.employeeName || currentUserFromPlanning.userName,
          employeeName: currentUserFromPlanning.employeeName || currentUserFromPlanning.userName,
          team: currentUserFromPlanning.team,
          role: currentUserFromPlanning.role || 'EMPLOYEE'
        });
      }
      
      return Array.from(employeeMap.values());
    }
    
    // Otherwise, process all team members
    // First priority: add all team members from the direct API call
    // These come from the user-service and include all team members regardless of teletravail status
    console.log('Processing team members for calendar:', this.teamMembers);
    this.teamMembers.forEach(member => {
      // Backend returns 'id' property, not 'userId'
      const userId = member.id || member.userId;
      if (userId && !employeeMap.has(userId)) {
        employeeMap.set(userId, {
          userId: userId,
          userName: member.employeeName || (member.firstName + ' ' + member.lastName),
          employeeName: member.employeeName || (member.firstName + ' ' + member.lastName),
          team: member.team,
          role: member.role || 'EMPLOYEE'
        });
      }
    });
    
    // Second priority: process planning entries from current view
    // This ensures we have all members with entries in the current date range
    this.planningEntries.forEach(entry => {
      if (entry.userId && !employeeMap.has(entry.userId)) {
        employeeMap.set(entry.userId, {
          userId: entry.userId,
          userName: entry.userName || 'User ' + entry.userId,
          employeeName: entry.employeeName || entry.userName || 'User ' + entry.userId,
          team: entry.team
        });
      } else if (entry.userId && employeeMap.has(entry.userId)) {
        // Update employee name if available in this entry and not in the map
        const existing = employeeMap.get(entry.userId);
        if ((!existing.employeeName || existing.employeeName.includes('User ')) && entry.employeeName) {
          existing.employeeName = entry.employeeName;
          existing.userName = entry.employeeName;
          employeeMap.set(entry.userId, existing);
        }
      }
    });
    
    // Final check: include employees from original entries set (historical data)
    // This ensures we have all team members, even if they don't have entries this week
    this.originalPlanningEntries.forEach(entry => {
      if (entry.userId && !employeeMap.has(entry.userId)) {
        employeeMap.set(entry.userId, {
          userId: entry.userId,
          userName: entry.userName || 'User ' + entry.userId,
          employeeName: entry.employeeName || entry.userName || 'User ' + entry.userId,
          team: entry.team
        });
      }
    });
    
    // If we still don't have any team members, show a default placeholder 
    if (employeeMap.size === 0 && this.currentTeamName) {
      // Add a placeholder user to indicate empty team
      employeeMap.set(0, {
        userId: 0,
        userName: 'Aucun membre trouvé dans l\'équipe',
        employeeName: 'Aucun membre trouvé dans l\'équipe',
        team: this.currentTeamName,
        role: ''
      });
    }
    
    // Convert Map to array and sort by name
    const employees = Array.from(employeeMap.values());
    
    // Sort employees by name
    return employees.sort((a, b) => {
      const nameA = (a.employeeName || a.userName || '').toLowerCase();
      const nameB = (b.employeeName || b.userName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
  
  /**
   * Show next week's dates (Monday-Friday)
   */
  showNextWeek(): void {
    const startDateObj = new Date(this.startDate);
    const nextMonday = new Date(startDateObj);
    nextMonday.setDate(startDateObj.getDate() + 7); // Next Monday is 7 days later
    
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4); // 4 days after Next Monday = Next Friday
    
    this.startDate = formatDate(nextMonday, 'yyyy-MM-dd', 'en');
    this.endDate = formatDate(nextFriday, 'yyyy-MM-dd', 'en');
    
    // Set navigation flags
    this.isCurrentWeek = false;
    this.isNextWeek = true;
    
    console.log('Next week dates set:', { start: this.startDate, end: this.endDate });
    
    // Reload planning data for the new date range
    this.loadPlanning();
  }
  
  /**
   * Show previous week's dates (back to current week)
   */
  showPreviousWeek(): void {
    // Since we only navigate between current and next week,
    // going back from next week should return to current week
    if (!this.isCurrentWeek) {
      this.setCurrentWeekDates();
      this.loadPlanning();
    }
  }
  
  /**
   * Get the letter representation for each day of the work week
   * @param dayIndex The index of the day (0-4 for Monday-Friday)
   * @returns Letter representation of the day
   */
  getDayLetter(dayIndex: number): string {
    // English version: M, T, W, T, F
    // French version: L, M, M, J, V
    const dayLetters = ['L', 'M', 'M', 'J', 'V'];
    return dayLetters[dayIndex] || '';
  }
  
  /**
   * Get formatted date range string for the week navigation
   * @returns Formatted date range like "12-16 May, 2025" or "19-23 Mai, 2025"
   */
  getFormattedDateRange(): string {
    // Parse start and end dates
    const startDateObj = new Date(this.startDate);
    const endDateObj = new Date(this.endDate);
    
    // Get day numbers
    const startDay = startDateObj.getDate();
    const endDay = endDateObj.getDate();
    
    // Get month name (use French month names)
    const months = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    const month = months[startDateObj.getMonth()];
    
    // Get year
    const year = startDateObj.getFullYear();
    
    // Return formatted string
    return `${startDay}-${endDay} ${month}, ${year}`;
  }
  
  /**
   * Get the week days to display in the calendar
   * Returns an array of Date objects for the days to show
   */
  getWeekDays(): Date[] {
    // Start with the start date and generate 5 days
    const days: Date[] = [];
    const startDateObj = new Date(this.startDate);
    
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(startDateObj);
      dayDate.setDate(startDateObj.getDate() + i);
      days.push(dayDate);
    }
    
    return days;
  }
  
  /**
   * Get employee's status for a specific date
   * @param userId User ID
   * @param date Date to check
   * @returns Status string (TELETRAVAIL, PENDING, OFFICE, MEETING, VACATION, etc)
   */
  /**
   * Convert role string to user-friendly label
   * @param role Role string from API
   * @returns User-friendly role label in French
   */
  getRoleLabel(role: string): string {
    // If no role is provided, return empty string
    if (!role) return '';
    
    // Convert role to uppercase for consistent matching
    const normalizedRole = role.toUpperCase();
    
    // Map roles to French user-friendly labels
    switch (normalizedRole) {
      case 'TEAM_LEADER':
        return 'Chef d\'équipe';
      case 'MANAGER':
        return 'Manager';
      case 'ADMIN':
        return 'Admin';
      case 'EMPLOYEE':
      default:
        return 'Employé';
    }
  }

  getEmployeeStatusForDate(userId: number, date: Date): string | null {
    // Format date to compare with entry dates
    const dateStr = formatDate(date, 'yyyy-MM-dd', 'en');
    
    // Find matching entry for this employee and date
    const entry = this.planningEntries.find(entry => 
      entry.userId === userId && 
      formatDate(new Date(entry.planningDate), 'yyyy-MM-dd', 'en') === dateStr
    );
    
    if (!entry) {
      // Default to OFFICE when no entry is found
      return 'OFFICE';
    }
    
    // Check directly for status fields first (more reliable)
    if (entry.planningStatus) {
      const status = entry.planningStatus.toUpperCase();
      
      // Map according to your requirements
      if (status === 'PENDING' || status === 'EN ATTENTE') {
        return 'PENDING';
      } else if (status === 'APPROVED' || status === 'TELETRAVAIL' || status === 'TÉLÉTRAVAIL') {
        return 'TELETRAVAIL';
      }
    }
    
    // If no explicit status, check work type
    if (entry.workType === 'Regular' || entry.workType === 'Exceptional') {
      // Default teletravail entry to TELETRAVAIL if no other status is set
      return 'TELETRAVAIL';
    } else if (entry.workType === 'Office') {
      return 'OFFICE';
    // Meeting option removed
    }
    
    // Default to office if we can't determine
    return 'OFFICE';
  }
  
}