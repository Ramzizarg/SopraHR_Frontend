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
  uniqueEmployees: any[] = []; // Store unique team members for display
  userProfilePhotos: Map<number, string | null> = new Map(); // Store user profile photos by userId
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
  searchEmployeeName: string = ''; // For managers to search employees by name
  filteredEmployees: any[] = []; // Holds the filtered employees based on search

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
  
  // Add this static Set at the class level
  private static loggedCombinations = new Set<string>();

  /**
   * Helper function to get the Monday of a given date's week
   * @param date The reference date
   * @returns Date object representing the Monday of that week
   */
  getMonday(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Set dates to current work week (Monday-Friday)
   * If current day is Saturday or Sunday, automatically show next week
   */
  setCurrentWeekDates(): void {
    try {
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      
      // If it's Saturday (6) or Sunday (0), show next week instead of current week
      if (currentDay === 6 || currentDay === 0) {
        this.showNextWeek();
        return;
      }
      
      // Get Monday using the helper method
      const monday = this.getMonday(today);
      
      // Calculate the Friday of current week
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4); // 4 days after Monday = Friday
      
      this.startDate = formatDate(monday, 'yyyy-MM-dd', 'en');
      this.endDate = formatDate(friday, 'yyyy-MM-dd', 'en');
      
      // Set navigation flags
      this.isCurrentWeek = true;
      this.isNextWeek = false;
      
      console.log('Current week dates set:', { start: this.startDate, end: this.endDate });
    } catch (error) {
      console.error('Error setting current week dates:', error);
      // Fallback: calculate dates manually
      const today = new Date();
      const monday = this.getMonday(today);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      
      this.startDate = formatDate(monday, 'yyyy-MM-dd', 'en');
      this.endDate = formatDate(friday, 'yyyy-MM-dd', 'en');
      
      this.isCurrentWeek = true;
      this.isNextWeek = false;
    }
  }

  ngOnInit(): void {
    // Set default date range to current week (Monday to Friday of this week)
    this.setCurrentWeekDates();
    
    // Explicitly ensure navigation flags are in correct initial state
    // This MUST be after setCurrentWeekDates to override any values set there
    this.isCurrentWeek = true;  // Initially disable left arrow (can't go before current week)
    this.isNextWeek = false;    // Initially enable right arrow (can go to next week)
    
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
      this.clearEmployeeSearch(); // Clear any name search when filtering to team leaders
    }
    
    // Set success message based on filter state
    if (this.showTeamLeadersOnly) {
      this.success = 'Affichage filtré: seulement les chefs d\'équipe';
    } else {
      this.success = 'Affichage de tous les utilisateurs';
    }
  }
  
  /**
   * Filter employees by name for managers
   */
  filterEmployeesByName(): void {
    if (!this.searchEmployeeName) {
      // If search is empty, reset to show all employees
      this.filteredEmployees = [...this.uniqueEmployees];
      return;
    }
    
    const searchTerm = this.searchEmployeeName.toLowerCase();
    this.filteredEmployees = this.uniqueEmployees.filter(employee => {
      const employeeName = (employee.employeeName || employee.userName || '').toLowerCase();
      return employeeName.includes(searchTerm);
    });
    
    this.success = `Recherche: ${this.filteredEmployees.length} employé(s) trouvé(s)`;
  }
  
  /**
   * Clear the employee name search
   */
  clearEmployeeSearch(): void {
    this.searchEmployeeName = '';
    this.filteredEmployees = [...this.uniqueEmployees];
    this.success = 'Recherche effacée';
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
        // Managers now see only their team members, similar to team leaders
        console.log('Manager view - loading team members');
        
        // Get manager's team information
        const teamName = this.currentTeamName;
        if (!teamName) {
          this.error = 'Impossible de charger les données: équipe non définie';
          this.loading = false;
          return;
        }

        // Load team members for the manager's team
        this.planningService.getTeamMembers(teamName)
          .subscribe({
            next: (members) => {
              console.log('Loaded team members:', members);
              this.teamMembers = members;
              
              // Fetch profile photos for each team member
              members.forEach(member => {
                if (member.id) {
                  this.fetchUserProfilePhoto(member.id);
                }
              });
              
              // Load planning entries for the team
              this.planningService.getTeamPlanning(teamName, this.startDate, this.endDate)
                .subscribe({
                  next: (data) => {
                    this.originalPlanningEntries = [...data]; // Store original data
                    this.planningEntries = this.showOnlyTeletravail ? 
                      this.filterTeletravailOnly(data) : data;
                    this.updateUniqueEmployees(); // Update unique employees when planning entries change
                    this.loading = false;
                  },
                  error: (err: any) => {
                    console.error('Planning service error:', err);
                    this.handleServiceError(err);
                  }
                });
            },
            error: (err: any) => {
              console.error('Error loading team members:', err);
              this.handleServiceError(err);
            }
          });
      } else if (this.currentTeamName) {
        // Load team members for any user with a team, not just team leaders
        this.planningService.getTeamMembers(this.currentTeamName)
          .subscribe({
            next: (members) => {
              console.log('Loaded team members:', members);
              this.teamMembers = members;
              
              // Fetch profile photos for each team member
              members.forEach(member => {
                if (member.id) {
                  this.fetchUserProfilePhoto(member.id);
                }
              });
              
              // Now load planning entries for the team
              // Ensure currentTeamName is not undefined before passing it
              if (this.currentTeamName) {
                this.planningService.getTeamPlanning(this.currentTeamName, this.startDate, this.endDate)
                  .subscribe({
                    next: (data) => {
                      this.originalPlanningEntries = [...data]; // Store original data
                      this.planningEntries = this.showOnlyTeletravail ? 
                        this.filterTeletravailOnly(data) : data;
                      this.updateUniqueEmployees(); // Update unique employees when planning entries change
                      this.loading = false;
                    },
                    error: (err: any) => {
                      console.error('Planning service error:', err);
                      this.handleServiceError(err);
                    }
                  });
              }
            },
            error: (err: any) => {
              console.error('Error loading team members:', err);
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
   * Toggle showing only current user entries
   */
  toggleShowOnlyCurrentUser(): void {
    this.showOnlyCurrentUser = !this.showOnlyCurrentUser;
    this.filterEntries();
    
    if (this.showOnlyCurrentUser) {
      this.success = 'Affichage filtré: seulement vos entrées';
    } else {
      this.success = 'Affichage de toute l\'équipe';
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
  filterTeletravailOnly(entries: PlanningResponse[]): PlanningResponse[] {
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
  
  /**
   * Navigation method to the teletravail request form
   */
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
   * Reject a teletravail request
   * @param requestId The ID of the request to reject
   * @param rejectionReason The reason for rejecting the request
   */
  private rejectTeletravailRequest(requestId: number, rejectionReason: string): void {
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
   * Handle click on status icon
   * @param event The click event
   * @param entry The planning entry
   */
  handleStatusClick(event: MouseEvent, entry: any): void {
    // Prevent default context menu
    event.preventDefault();

    // If user is not a team leader or manager (i.e., employee)
    if (!this.isTeamLeader && !this.isManager) {
      // Only allow cancellation of own requests
      if (entry.userId !== this.currentUserId) {
        Swal.fire({
          title: 'Action non autorisée',
          text: 'Vous ne pouvez annuler que vos propres demandes de télétravail',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Check if the request date is in the future
      const requestDate = new Date(entry.planningDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (requestDate < today) {
        Swal.fire({
          title: 'Annulation impossible',
          text: 'Vous ne pouvez pas annuler une demande de télétravail pour une date passée',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Show confirmation dialog directly for employees
      Swal.fire({
        title: 'Annuler la demande',
        text: 'Êtes-vous sûr de vouloir annuler cette demande de télétravail ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, annuler',
        cancelButtonText: 'Non, conserver',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
      }).then((result) => {
        if (result.isConfirmed) {
          this.cancelTeletravailRequest(entry.id);
        }
      });
      return;
    }

    // For team leaders and managers:
    // Right click (button 2) for request removal
    if (event.button === 2) {
      // Only allow cancellation of own requests
      if (entry.userId !== this.currentUserId) {
        Swal.fire({
          title: 'Action non autorisée',
          text: 'Vous ne pouvez annuler que vos propres demandes de télétravail',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Check if the request date is in the future
      const requestDate = new Date(entry.planningDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (requestDate < today) {
        Swal.fire({
          title: 'Annulation impossible',
          text: 'Vous ne pouvez pas annuler une demande de télétravail pour une date passée',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Show confirmation dialog
      Swal.fire({
        title: 'Annuler la demande',
        text: 'Êtes-vous sûr de vouloir annuler cette demande de télétravail ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, annuler',
        cancelButtonText: 'Non, conserver',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
      }).then((result) => {
        if (result.isConfirmed) {
          this.cancelTeletravailRequest(entry.id);
        }
      });
    }
    // Left click for approval/refusal
    else if (event.button === 0) {
      // Check if user is team leader or manager
      if (!this.isTeamLeader && !this.isManager) {
        Swal.fire({
          title: 'Action non autorisée',
          text: 'Seuls les chefs d\'équipe et les managers peuvent approuver ou refuser les demandes',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Show approval options
      this.showApprovalOptions(entry);
    }
  }
  
  /**
   * Show next week's dates (Monday-Friday)
   */
  showNextWeek(): void {
    try {
      let startDateObj: Date;
      
      // Validate current startDate before using it
      if (!this.startDate || isNaN(new Date(this.startDate).getTime())) {
        // If current startDate is invalid, use today
        startDateObj = this.getMonday(new Date());
      } else {
        startDateObj = new Date(this.startDate);
      }
      
      // Calculate next Monday
      const nextMonday = new Date(startDateObj);
      nextMonday.setDate(startDateObj.getDate() + 7); // Next Monday is 7 days later
      
      const nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextMonday.getDate() + 4); // 4 days after Next Monday = Next Friday
      
      this.startDate = formatDate(nextMonday, 'yyyy-MM-dd', 'en');
      this.endDate = formatDate(nextFriday, 'yyyy-MM-dd', 'en');
      
      // Set navigation flags
      this.isCurrentWeek = false; // Enable left arrow (we can now go back to current week)
      this.isNextWeek = true;     // Disable right arrow (we can only see one week ahead)
      
      console.log('Next week dates set:', { start: this.startDate, end: this.endDate });
    } catch (error) {
      console.error('Error setting next week dates:', error);
      // Set fallback dates
      const today = new Date();
      const monday = this.getMonday(today);
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      
      const nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextMonday.getDate() + 4);
      
      this.startDate = formatDate(nextMonday, 'yyyy-MM-dd', 'en');
      this.endDate = formatDate(nextFriday, 'yyyy-MM-dd', 'en');
      
      // Set navigation flags
      this.isCurrentWeek = false;
      this.isNextWeek = true;
    }
    
    // Reload planning data for the new date range
    this.loadPlanning();
  }
  
  /**
   * Show previous week's dates (May 26-30) when left arrow is clicked
   */
  showPreviousWeek(): void {
    try {
      let startDateObj: Date;
      
      // Validate current startDate before using it
      if (!this.startDate || isNaN(new Date(this.startDate).getTime())) {
        // If current startDate is invalid, use current week's Monday
        startDateObj = this.getMonday(new Date());
      } else {
        startDateObj = new Date(this.startDate);
      }
      
      // Calculate previous Monday (1 week before current date)
      const prevMonday = new Date(startDateObj);
      prevMonday.setDate(startDateObj.getDate() - 7); // Previous Monday is 7 days earlier
      
      const prevFriday = new Date(prevMonday);
      prevFriday.setDate(prevMonday.getDate() + 4); // 4 days after Previous Monday = Previous Friday
      
      this.startDate = formatDate(prevMonday, 'yyyy-MM-dd', 'en');
      this.endDate = formatDate(prevFriday, 'yyyy-MM-dd', 'en');
      
      // Set navigation flags for previous week
      this.isCurrentWeek = false; // We're now viewing a previous week, so left arrow can be enabled
      this.isNextWeek = false;    // Enable right arrow when viewing previous week
      
      console.log('Previous week dates set:', { start: this.startDate, end: this.endDate });
    } catch (error) {
      console.error('Error setting previous week dates:', error);
    }
    
    // Reload planning data for the new date range
    this.loadPlanning();
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
    
    // Validate startDate to ensure it's not invalid
    let startDateObj: Date;
    try {
      // First check if startDate is valid
      if (!this.startDate || this.startDate.trim() === '') {
        console.error('Invalid or empty startDate', this.startDate);
        // If invalid, use the current date as a fallback
        startDateObj = this.getMonday(new Date());
      } else {
        startDateObj = new Date(this.startDate);
        
        // Check if date is valid
        if (isNaN(startDateObj.getTime())) {
          console.error('Invalid date from startDate string:', this.startDate);
          startDateObj = this.getMonday(new Date());
        }
      }
    } catch (error) {
      console.error('Error creating date from startDate:', error);
      startDateObj = this.getMonday(new Date());
    }
    
    // Generate the 5 weekdays
    for (let i = 0; i < 5; i++) {
      try {
        const dayDate = new Date(startDateObj);
        dayDate.setDate(startDateObj.getDate() + i);
        days.push(dayDate);
      } catch (error) {
        console.error(`Error creating day date for index ${i}:`, error);
        // Push a valid date as fallback
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + i);
        days.push(fallbackDate);
      }
    }
    
    return days;
  }
  
  /**
   * Get employee's status for a specific date
   * @param userId User ID
   * @param date Date to check
   * @returns Status string (TELETRAVAIL, PENDING, OFFICE, MEETING, VACATION, etc)
   */
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

  /**
   * Get the work type (Regular or Exceptional) for a specific date
   * @param userId User ID
   * @param date Date to check
   * @returns Work type string ('Regular' or 'Exceptional')
   */
  getWorkTypeForDate(userId: number, date: Date): string {
    // Format date to compare with entry dates
    const dateStr = formatDate(date, 'yyyy-MM-dd', 'en');
    
    // Find matching entry for this employee and date
    const entry = this.planningEntries.find(entry => 
      entry.userId === userId && 
      formatDate(new Date(entry.planningDate), 'yyyy-MM-dd', 'en') === dateStr
    );
    
    if (!entry || !entry.workType) {
      // Default to Regular when no entry is found or no workType is specified
      return 'Regular';
    }
    
    // Normalize workType to handle different capitalizations
    const workType = entry.workType.toLowerCase();
    
    // Create a unique key for this user-date combination
    const logKey = `${userId}-${dateStr}`;
    
    // Only log if we haven't seen this combination before
    if (!PlanningComponent.loggedCombinations.has(logKey)) {
      console.log(`Work type for user ${userId} on ${dateStr}: ${workType}`);
      PlanningComponent.loggedCombinations.add(logKey);
    }
    
    // Handle different capitalizations and formats
    if (workType.includes('exceptional') || workType.includes('exceptionnel')) {
      return 'Exceptional';
    } else if (workType.includes('regular') || workType.includes('régulier')) {
      return 'Regular';
    }
    
    // If we can't determine, check for specific strings that might indicate exceptional telework
    if (workType.includes('except') || workType.includes('except') || 
        workType === 'e' || workType === 'ex' || workType === 'exc') {
      return 'Exceptional';
    }
    
    // For any other telework type, return Regular as default
    return 'Regular';
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
   * Update the list of unique employees based on team members and planning entries
   */
  updateUniqueEmployees(): void {
    const uniqueEmployeeMap = new Map();
    
    // First add all team members
    this.teamMembers.forEach(member => {
      if (member.id) {
        uniqueEmployeeMap.set(member.id, {
          userId: member.id,
          userName: member.firstName + ' ' + member.lastName,
          employeeName: member.firstName + ' ' + member.lastName,
          role: member.role || 'EMPLOYEE'
        });
      }
    });
    
    // Add any employees from planning entries not already in the map
    this.planningEntries.forEach(entry => {
      if (entry.userId && !uniqueEmployeeMap.has(entry.userId)) {
        uniqueEmployeeMap.set(entry.userId, {
          userId: entry.userId,
          userName: entry.employeeName || ('Utilisateur #' + entry.userId),
          employeeName: entry.employeeName,
          role: entry.role || 'EMPLOYEE'
        });
      }
    });
    
    // Convert map to array and assign to our property
    this.uniqueEmployees = Array.from(uniqueEmployeeMap.values());
    this.filteredEmployees = [...this.uniqueEmployees]; // Initialize filtered employees
    console.log('Updated unique employees:', this.uniqueEmployees);
    
    // Initialize tooltips after updating the DOM
    setTimeout(() => this.initializeTooltips(), 100);
  }
  
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

  /**
   * Fetch profile photo for a specific user and store it in the userProfilePhotos map
   * @param userId The ID of the user
   */
  fetchUserProfilePhoto(userId: number): void {
    if (!userId) return;
    
    // Skip if we already have this user's photo
    if (this.userProfilePhotos.has(userId)) return;
    
    this.planningService.getUserProfilePhoto(userId).subscribe({
      next: (photoUrl) => {
        if (photoUrl) {
          this.userProfilePhotos.set(userId, photoUrl);
        }
      },
      error: (error) => {
        // Don't log 404 errors as they are expected for users without photos
        if (error.status !== 404) {
          console.error('Error fetching profile photo for user', userId, error);
        }
        // Set null in the map to indicate no photo available
        this.userProfilePhotos.set(userId, null);
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
  
  /**
   * Show a dialog with options to approve or reject a pending request
   * @param entry The planning entry object
   */
  private showApprovalOptions(entry: any) {
    // Check if the request is from the current user (manager/team leader)
    if (entry.userId === this.currentUserId) {
      Swal.fire({
        title: 'Action non autorisée',
        text: 'Vous ne pouvez pas approuver ou refuser vos propres demandes de télétravail',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Translate work type to French and check for exceptional type
    const isExceptional = entry.workType?.toLowerCase() === 'exceptional' || 
                         entry.workType?.toLowerCase() === 'exceptionnelle';
    const workTypeFr = isExceptional ? 'Exceptionnelle' : 'Régulière';
    
    Swal.fire({
      title: 'Gérer la demande',
      html: `
        <div style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; font-size: 1.1em; line-height: 1.6;">
          <p style="margin-bottom: 1.5em; color: #2c3e50;">
            Souhaitez-vous approuver ou refuser la demande de télétravail de 
            <strong style="color: #3498db;">${entry.employeeName}</strong>?
          </p>
          <div style="background-color: #f8f9fa; padding: 1em; border-radius: 8px; margin-bottom: 1em;">
            <p style="margin: 0.5em 0;">
              <span style="color: #7f8c8d; font-weight: 500;">Type:</span>
              <span style="color: #2c3e50; margin-left: 0.5em;">${workTypeFr}</span>
            </p>
            ${isExceptional ? `
            <p style="margin: 0.5em 0;">
              <span style="color: #7f8c8d; font-weight: 500;">Raison:</span>
              <span style="color: #2c3e50; margin-left: 0.5em;">${entry.reasons || 'Non spécifiée'}</span>
            </p>
            ` : ''}
            <p style="margin: 0.5em 0;">
              <span style="color: #7f8c8d; font-weight: 500;">Date:</span>
              <span style="color: #2c3e50; margin-left: 0.5em;">${formatDate(entry.planningDate, 'dd/MM/yyyy', 'fr')}</span>
            </p>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approuver',
      cancelButtonText: 'Refuser',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      customClass: {
        popup: 'animated fadeInDown',
        title: 'swal2-title-custom',
        htmlContainer: 'swal2-html-container-custom',
        confirmButton: 'swal2-confirm-button-custom',
        cancelButton: 'swal2-cancel-button-custom'
      },
      buttonsStyling: true,
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.approveTeletravailRequest(entry.id);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.rejectTeletravailRequest(entry.id, '');
      }
    });
  }

  /**
   * Show a dialog with options to reject an approved request
   * @param requestId The ID of the request
   * @param employeeName The name of the employee
   */
  private showRejectionOptions(requestId: number, employeeName: string): void {
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
   * Prompt for rejection reason
   * @param requestId The ID of the request
   * @param employeeName The name of the employee
   */
  private promptForRejectionReason(requestId: number, employeeName: string): void {
    Swal.fire({
      title: 'Raison du refus',
      input: 'textarea',
      inputLabel: `Veuillez indiquer la raison du refus pour ${employeeName}`,
      inputPlaceholder: 'Entrez votre raison ici...',
      showCancelButton: true,
      confirmButtonText: 'Confirmer',
      cancelButtonText: 'Annuler',
      inputValidator: (value) => {
        if (!value) {
          return 'La raison est requise!';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.rejectTeletravailRequest(requestId, result.value);
      }
    });
  }

  /**
   * Get the planning entry for a specific user and date
   * @param userId The user ID
   * @param date The date
   * @returns The planning entry or undefined if not found
   */
  getPlanningEntry(userId: number, date: Date): any {
    return this.planningEntries.find(entry => 
      entry.userId === userId && 
      new Date(entry.planningDate).toDateString() === date.toDateString()
    );
  }

}