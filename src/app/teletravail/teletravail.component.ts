import { Component, OnInit, Renderer2, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { TeletravailForm, TeletravailService, TeletravailResponse, TeletravailStatus, StatusUpdateRequest } from './TeletravailService';
import { AuthService } from '../login/AuthService';
import { ProfileService } from '../services/profile.service';
import Swal from 'sweetalert2';
import { ContactService, ContactRequest } from '../services/contact.service';

// tslint:disable-next-line:use-inline-template-type-checking
@Component({
  selector: 'app-teletravail',
  templateUrl: './teletravail.component.html',
  styleUrls: ['./teletravail.component.css', '../shared/header-footer.css']
})
export class TeletravailComponent implements OnInit {
  // Contact modal properties
  isContactModalOpen = false;
  // Make TeletravailStatus enum available in the template
  TeletravailStatus = TeletravailStatus;
  // Form fields
  travailType: string = '';
  teletravailDate: string = '';
  travailMaison: string = '';
  selectedPays: string = '';
  selectedGouvernorat: string = '';
  reason: string = '';
  rejectionReason: string = '';
  
  // Multiple date selection for exceptional requests
  selectedDates: string[] = [];
  // Multiple date selection for regular requests
  regularSelectedDates: string[] = [];
  dateSelectorValue: string = '';
  // Travel location
  travailLocation: string = '';
  // Travel reason for exceptional requests
  travailReason: string = '';

  // Request management
  userRequests: TeletravailResponse[] = [];
  isSubmitting: boolean = false;
  statusColors = {
    [TeletravailStatus.PENDING]: 'bg-warning',
    [TeletravailStatus.APPROVED]: 'bg-success',
    [TeletravailStatus.REJECTED]: 'bg-danger'
  };
  statusLabels = {
    [TeletravailStatus.PENDING]: 'En attente',
    [TeletravailStatus.APPROVED]: 'Approuvé',
    [TeletravailStatus.REJECTED]: 'Refusé'
  };

  countries: string[] = [];
  filteredGouvernorats: string[] = [];
  startOfCurrentWeek: string = '';
  endOfCurrentWeek: string = '';
  startOfNextWeek: string = '';
  endOfNextWeek: string = '';
  fridayCutoff: string = '';
  today: string = ''; // Added to track today's date for min restriction
  isDateDisabled: boolean = false;
  existingRequestDates: string[] = [];

  // Mobile menu properties
  isMobileMenuOpen: boolean = false;
  @ViewChild('navmenu') navMenu!: ElementRef;
  @ViewChild('mobileNavToggle') mobileNavToggle!: ElementRef;

  // Profile photo properties
  isProfilePopupOpen: boolean = false;
  profilePhotoUrl: string | null = null;
  currentUser: any = null;

  constructor(
    private teletravailService: TeletravailService,
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    private profileService: ProfileService,
    private contactService: ContactService
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

  ngOnInit(): void {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    console.log('TeletravailComponent: Loading page with token');
    
    this.calculateWeekDates();
    setInterval(() => this.calculateWeekDates(), 60000);
    this.loadCountries();
    this.loadRequests();
    
    // Set up user info and profile photo
    this.authService.currentUser.subscribe((user) => {
      if (user) {
        this.currentUser = user;
        this.fetchProfilePhoto(user.id);
      }
    });
    
    // Setup window resize event to handle responsive behavior
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });
    
    // Initialize mobile menu styles
    setTimeout(() => {
      if (this.mobileNavToggle) {
        this.renderer.setStyle(this.mobileNavToggle.nativeElement, 'display', window.innerWidth <= 991 ? 'block' : 'none');
      }
    }, 0);
  }

  private loadCountries(): void {
    this.teletravailService.getCountries().subscribe({
      next: (countries) => this.countries = countries,
      error: (err) => {
        console.error('Failed to load countries:', err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger la liste des pays.',
          confirmButtonText: 'OK',
          timer: 3000,
        });
      }
    });
  }

  private loadRequests(): void {
    // Load user requests for date validation in the form
    this.teletravailService.getUserRequests().subscribe({
      next: (requests) => {
        this.userRequests = requests;
        this.existingRequestDates = requests
          .filter(r => {
            const date = new Date(r.teletravailDate);
            const start = new Date(this.startOfCurrentWeek);
            const end = new Date(this.endOfNextWeek);
            return date >= start && date <= end;
          })
          .map(r => r.teletravailDate);
        console.log('Existing request dates:', this.existingRequestDates);
      },
      error: (err) => {
        console.error('Failed to load existing requests:', err);
        let errorMessage = 'Impossible de charger vos demandes existantes. Veuillez réessayer plus tard.';
        if (err.status === 401) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          this.logout();
        } else if (err.status === 0) {
          errorMessage = 'Serveur inaccessible. Vérifiez votre connexion.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: errorMessage,
          confirmButtonText: 'OK',
          timer: 3000,
        });
      }
    });
  }
  
  private handleApiError(err: any, defaultMessage: string): void {
    let errorMessage = defaultMessage;
    if (err.status === 401) {
      errorMessage = 'Session expirée. Veuillez vous reconnecter.';
      this.logout();
    } else if (err.status === 403) {
      errorMessage = 'Vous n\'avez pas les permissions nécessaires pour cette action.';
    } else if (err.status === 0) {
      errorMessage = 'Serveur inaccessible. Vérifiez votre connexion.';
    }
    Swal.fire({
      icon: 'error',
      title: 'Erreur',
      text: errorMessage,
      confirmButtonText: 'OK'
    });
  }
  
  calculateWeekDates(): void {
    const today = new Date();
    this.today = this.formatDate(today); // Set today's date
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = today.getHours();
    
    // Check if it's Friday after work hours (5PM+), Saturday, or Sunday
    const isFridayEvening = dayOfWeek === 5 && currentHour >= 17;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isFridayEvening || isWeekend) { 
      // After Friday or on weekend - show the next two weeks
      console.log('After Friday cutoff - showing next two weeks');
      
      // Calculate the start of next week (next Monday)
      const startNextMonday = new Date(today);
      const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // If Sunday, next day is Monday
      startNextMonday.setDate(today.getDate() + daysUntilNextMonday);
      startNextMonday.setHours(0, 0, 0, 0);
      this.startOfCurrentWeek = this.formatDate(startNextMonday);

      // End of next week (Sunday)
      const endNextSunday = new Date(startNextMonday);
      endNextSunday.setDate(startNextMonday.getDate() + 6);
      endNextSunday.setHours(23, 59, 59, 999);
      this.endOfCurrentWeek = this.formatDate(endNextSunday);

      // Start of the week after next
      const startFollowingMonday = new Date(startNextMonday);
      startFollowingMonday.setDate(startNextMonday.getDate() + 7);
      startFollowingMonday.setHours(0, 0, 0, 0);
      this.startOfNextWeek = this.formatDate(startFollowingMonday);

      // End of the week after next
      const endFollowingSunday = new Date(startFollowingMonday);
      endFollowingSunday.setDate(startFollowingMonday.getDate() + 6);
      endFollowingSunday.setHours(23, 59, 59, 999);
      this.endOfNextWeek = this.formatDate(endFollowingSunday);

      // Friday of next week
      const friday = new Date(startNextMonday);
      friday.setDate(startNextMonday.getDate() + 4);
      friday.setHours(0, 0, 0, 0);
      this.fridayCutoff = this.formatDate(friday);
    } else { 
      // Normal case (Monday to Friday daytime) - show current week and next week
      console.log('Normal weekday - showing current week and next week');
      
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startCurrent = new Date(today);
      startCurrent.setDate(today.getDate() - diffToMonday);
      startCurrent.setHours(0, 0, 0, 0);
      this.startOfCurrentWeek = this.formatDate(startCurrent);

      const endCurrent = new Date(startCurrent);
      endCurrent.setDate(startCurrent.getDate() + 6);
      endCurrent.setHours(23, 59, 59, 999);
      this.endOfCurrentWeek = this.formatDate(endCurrent);

      const friday = new Date(startCurrent);
      friday.setDate(startCurrent.getDate() + 4);
      friday.setHours(0, 0, 0, 0);
      this.fridayCutoff = this.formatDate(friday);

      const startNext = new Date(startCurrent);
      startNext.setDate(startCurrent.getDate() + 7);
      startNext.setHours(0, 0, 0, 0);
      this.startOfNextWeek = this.formatDate(startNext);

      const endNext = new Date(startNext);
      endNext.setDate(startNext.getDate() + 6);
      endNext.setHours(23, 59, 59, 999);
      this.endOfNextWeek = this.formatDate(endNext);
    }
    
    console.log(`Date ranges: Current week ${this.startOfCurrentWeek} to ${this.endOfCurrentWeek}, Next week ${this.startOfNextWeek} to ${this.endOfNextWeek}`);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  isPastFridayCutoff(): boolean {
    const now = new Date();
    const friday = new Date(this.fridayCutoff);
    friday.setHours(0, 0, 0, 0);
    return now >= friday;
  }

  disableWeekends(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = new Date(input.value);

    const minAllowedDate = new Date(this.today > this.startOfCurrentWeek ? this.today : this.startOfCurrentWeek);
    const maxAllowedDate = new Date(this.endOfNextWeek);

    if (selectedDate < minAllowedDate || selectedDate > maxAllowedDate) {
      this.showDateError('Veuillez sélectionner une date dans les deux semaines affichées, à partir d\'aujourd\'hui.');
      input.value = '';
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les weekends ne sont pas disponibles.');
      input.value = '';
      return;
    }

    if (this.existingRequestDates.includes(input.value)) {
      this.showDateError('Vous avez déjà une demande pour ce jour.');
      input.value = '';
      return;
    }

    const selectedEpoch = selectedDate.getTime() / (1000 * 60 * 60 * 24);
    for (const dateStr of this.existingRequestDates) {
      const existingDate = new Date(dateStr);
      const existingEpoch = existingDate.getTime() / (1000 * 60 * 60 * 24);
      if (Math.abs(selectedEpoch - existingEpoch) === 1) {
        this.showDateError('Les jours de télétravail ne doivent pas être consécutifs.');
        input.value = '';
        return;
      }
    }

    const requestDate = new Date(input.value);
    const weekStart = requestDate >= new Date(this.startOfNextWeek) ? this.startOfNextWeek : this.startOfCurrentWeek;
    const weekEnd = requestDate >= new Date(this.startOfNextWeek) ? this.endOfNextWeek : this.endOfCurrentWeek;
    const requestsInWeek = this.existingRequestDates.filter(d => {
      const date = new Date(d);
      return date >= new Date(weekStart) && date <= new Date(weekEnd);
    });
    if (requestsInWeek.length >= 2) {
      this.showDateError(`Vous avez déjà atteint la limite de 2 jours pour la semaine du ${weekStart}.`);
      input.value = '';
      return;
    }

    this.isDateDisabled = false;
  }

  private showDateError(message: string): void {
    this.isDateDisabled = true;
    Swal.fire({
      icon: 'warning',
      title: 'Date non valide',
      text: message,
      confirmButtonText: 'OK',
      timer: 3000,
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      this.isDateDisabled = false;
    });
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.teletravailDate = input.value;
  }

  // Helper method to check if dates are in the same week
  private areDatesInSameWeek(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Get the week number for each date
    const getWeekNumber = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };
    
    // Check if week numbers and years match
    return getWeekNumber(d1) === getWeekNumber(d2) && d1.getFullYear() === d2.getFullYear();
  }
  
  // Helper method to check if dates are consecutive
  private areDatesConsecutive(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Calculate difference in days
    const timeDiff = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return diffDays === 1;
  }
  
  onRegularDateSelect(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedDate = inputElement.value;
    
    if (!selectedDate) return;
    
    // Check if date is a weekend
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les demandes de télétravail ne sont pas autorisées pour les weekends.');
      this.dateSelectorValue = '';
      return;
    }

    // Check if there's already a telework request for this date
    const existingRequest = this.userRequests.find(request => 
      request.teletravailDate === selectedDate && 
      (request.status === TeletravailStatus.PENDING || request.status === TeletravailStatus.APPROVED)
    );

    if (existingRequest) {
      this.showDateError(`Vous avez déjà une demande ${existingRequest.travailType === 'reguliere' ? 'régulière' : 'exceptionnelle'} pour cette date.`);
      this.dateSelectorValue = '';
      return;
    }

    // Check existing regular telework requests for the same week
    const selectedWeekStart = new Date(date);
    selectedWeekStart.setDate(date.getDate() - date.getDay() + 1); // Start of week (Monday)
    selectedWeekStart.setHours(0, 0, 0, 0);
    
    const selectedWeekEnd = new Date(selectedWeekStart);
    selectedWeekEnd.setDate(selectedWeekStart.getDate() + 6); // End of week (Sunday)
    selectedWeekEnd.setHours(23, 59, 59, 999);

    const existingRequestsInWeek = this.userRequests.filter(request => {
      const requestDate = new Date(request.teletravailDate);
      return requestDate >= selectedWeekStart && 
             requestDate <= selectedWeekEnd && 
             request.travailType === 'reguliere' &&
             (request.status === TeletravailStatus.PENDING || request.status === TeletravailStatus.APPROVED);
    });

    if (existingRequestsInWeek.length >= 2) {
      this.showDateError(`Vous avez déjà ${existingRequestsInWeek.length} demande(s) régulière(s) pour cette semaine.`);
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if date is already selected in exceptional telework
    if (this.selectedDates.includes(selectedDate)) {
      this.showDateError('Cette date est déjà sélectionnée pour une demande exceptionnelle.');
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if date is already selected
    if (this.regularSelectedDates.includes(selectedDate)) {
      this.showDateError('Cette date est déjà sélectionnée.');
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if we're not exceeding maximum number of days (2)
    if (this.regularSelectedDates.length >= 2) {
      this.showDateError('Vous ne pouvez pas sélectionner plus de 2 jours pour une demande régulière.');
      this.dateSelectorValue = '';
      return;
    }
    
    // If we already have one date, perform additional validations
    if (this.regularSelectedDates.length === 1) {
      const existingDate = this.regularSelectedDates[0];
      
      // Check if dates are in the same week
      if (!this.areDatesInSameWeek(existingDate, selectedDate)) {
        this.showDateError('Les deux dates doivent être dans la même semaine.');
        this.dateSelectorValue = '';
        return;
      }
      
      // Check if dates are consecutive
      if (this.areDatesConsecutive(existingDate, selectedDate)) {
        this.showDateError('Les jours sélectionnés ne doivent pas être consécutifs.');
        this.dateSelectorValue = '';
        return;
      }
    }
    
    // Add the date to selected dates
    this.regularSelectedDates.push(selectedDate);
    // Sort dates chronologically
    this.regularSelectedDates.sort();
    // Reset the date selector value
    this.dateSelectorValue = '';
  }
  
  removeRegularSelectedDate(index: number): void {
    if (index >= 0 && index < this.regularSelectedDates.length) {
      this.regularSelectedDates.splice(index, 1);
    }
  }
  
  onExceptionalDateSelect(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedDate = inputElement.value;
    
    if (!selectedDate) return;
    
    // Check if date is a weekend
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les demandes de télétravail ne sont pas autorisées pour les weekends.');
      this.dateSelectorValue = '';
      return;
    }

    // Check if there's already a telework request for this date
    const existingRequest = this.userRequests.find(request => 
      request.teletravailDate === selectedDate && 
      (request.status === TeletravailStatus.PENDING || request.status === TeletravailStatus.APPROVED)
    );

    if (existingRequest) {
      this.showDateError(`Vous avez déjà une demande ${existingRequest.travailType === 'reguliere' ? 'régulière' : 'exceptionnelle'} pour cette date.`);
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if date is already selected in regular telework
    if (this.regularSelectedDates.includes(selectedDate)) {
      this.showDateError('Cette date est déjà sélectionnée pour une demande régulière.');
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if date is already selected
    if (this.selectedDates.includes(selectedDate)) {
      this.showDateError('Cette date est déjà sélectionnée.');
      this.dateSelectorValue = '';
      return;
    }
    
    // Check if we're not exceeding maximum number of days (5)
    if (this.selectedDates.length >= 5) {
      this.showDateError('Vous ne pouvez pas sélectionner plus de 5 jours.');
      this.dateSelectorValue = '';
      return;
    }
    
    // Add the date to selected dates
    this.selectedDates.push(selectedDate);
    // Sort dates chronologically
    this.selectedDates.sort();
    // Reset the date selector value
    this.dateSelectorValue = '';
  }
  
  removeSelectedDate(index: number): void {
    if (index >= 0 && index < this.selectedDates.length) {
      this.selectedDates.splice(index, 1);
    }
  }

  onCountryChange(): void {
    this.selectedGouvernorat = '';
    if (this.selectedPays) {
      this.teletravailService.getRegions(this.selectedPays).subscribe({
        next: (regions) => this.filteredGouvernorats = regions,
        error: (err) => {
          console.error('Failed to load regions:', err);
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de charger la liste des régions.',
            confirmButtonText: 'OK',
            timer: 3000,
          });
        }
      });
    } else {
      this.filteredGouvernorats = [];
    }
  }

  onSubmit(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    
    // Validation logic
    const isExceptional = this.travailType === 'exceptionnelle';
    const isRegular = this.travailType === 'reguliere';
    const requiresLocation = this.travailMaison === 'non';
    
    // Form validation
    if (!this.travailType) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez sélectionner un type de travail.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    // For regular telework, require dates selection
    if (isRegular && this.regularSelectedDates.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez sélectionner au moins une date pour votre demande régulière.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    // For exceptional telework, require dates selection
    if (isExceptional && this.selectedDates.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez sélectionner au moins une date pour votre demande exceptionnelle.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    if (!this.travailMaison) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez indiquer si vous travaillerez depuis votre domicile habituel.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    // Location validation only applies for non-home work
    if (requiresLocation && (!this.selectedPays || !this.selectedGouvernorat)) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez sélectionner un pays et un gouvernorat.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    // Reason validation only applies for exceptional requests
    if (isExceptional && !this.travailReason) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez fournir une raison pour cette demande exceptionnelle.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      this.isSubmitting = false;
      return;
    }
    
    // Create request object
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Utilisateur non identifié. Veuillez vous reconnecter.',
        confirmButtonText: 'OK'
      });
      this.isSubmitting = false;
      return;
    }
    
    // For exceptional telework with multiple dates, submit separate requests for each date
    if (isExceptional && this.selectedDates.length > 0) {
      console.log('Creating multiple requests for exceptional telework');
      
      // Track how many requests have been processed and statuses
      let completedRequests = 0;
      let successfulRequests = 0;
      let failedRequests = 0;
      
      // Process each date as a separate request
      this.selectedDates.forEach((date, index) => {
        const request: TeletravailForm = {
          travailType: this.travailType,
          teletravailDate: date,
          travailMaison: this.travailMaison === 'oui' ? 'true' : 'false',
          reason: isExceptional ? this.travailReason || '' : '',
          selectedPays: requiresLocation ? this.selectedPays || '' : '',
          selectedGouvernorat: requiresLocation ? this.selectedGouvernorat || '' : ''
        };
        
        console.log(`Sending request ${index + 1}/${this.selectedDates.length}:`, request);
        
        this.teletravailService.submitRequest(request).subscribe({
          next: () => {
            completedRequests++;
            successfulRequests++;
            
            // When all requests are processed, show appropriate message
            if (completedRequests === this.selectedDates.length) {
              this.isSubmitting = false;
              
              if (failedRequests === 0) {
                // All requests succeeded
                Swal.fire({
                  icon: 'success',
                  title: 'Succès',
                  text: 'Vos demandes de télétravail ont été soumises avec succès.',
                  confirmButtonText: 'OK',
                  timer: 3000
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                  this.resetForm();    // Clear the form
                });
              } else if (successfulRequests > 0) {
                // Some requests succeeded, some failed
                Swal.fire({
                  icon: 'warning',
                  title: 'Attention',
                  text: `${successfulRequests} demandes soumises avec succès, ${failedRequests} demandes ont échoué.`,
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                });
              } else {
                // All requests failed
                Swal.fire({
                  icon: 'error',
                  title: 'Erreur',
                  text: 'Une erreur est survenue lors de la soumission de vos demandes.',
                  confirmButtonText: 'OK'
                });
              }
            }
          },
          error: (err) => {
            console.error(`Error saving request ${index + 1}:`, err);
            completedRequests++;
            failedRequests++;
            
            // When all requests are processed, show appropriate message
            if (completedRequests === this.selectedDates.length) {
              this.isSubmitting = false;
              
              if (failedRequests === this.selectedDates.length) {
                // All requests failed
                Swal.fire({
                  icon: 'error',
                  title: 'Erreur',
                  text: 'Une erreur est survenue lors de la soumission de vos demandes.',
                  confirmButtonText: 'OK'
                });
              } else {
                // Some requests succeeded, some failed
                Swal.fire({
                  icon: 'warning',
                  title: 'Attention',
                  text: `${successfulRequests} demandes soumises avec succès, ${failedRequests} demandes ont échoué.`,
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                });
              }
            }
          }
        });
      });
    }
    // For regular telework with multiple dates, submit separate requests for each date
    else if (isRegular && this.regularSelectedDates.length > 0) {
      console.log('Creating multiple requests for regular telework');
      
      // Track how many requests have been processed and statuses
      let completedRequests = 0;
      let successfulRequests = 0;
      let failedRequests = 0;
      
      // Process each date as a separate request
      this.regularSelectedDates.forEach((date, index) => {
        const request: TeletravailForm = {
          travailType: this.travailType,
          teletravailDate: date,
          travailMaison: this.travailMaison === 'oui' ? 'true' : 'false',
          reason: '',
          selectedPays: requiresLocation ? this.selectedPays || '' : '',
          selectedGouvernorat: requiresLocation ? this.selectedGouvernorat || '' : ''
        };
        
        console.log(`Sending request ${index + 1}/${this.regularSelectedDates.length}:`, request);
        
        this.teletravailService.submitRequest(request).subscribe({
          next: () => {
            completedRequests++;
            successfulRequests++;
            
            // When all requests are processed, show appropriate message
            if (completedRequests === this.regularSelectedDates.length) {
              this.isSubmitting = false;
              
              if (failedRequests === 0) {
                // All requests succeeded
                Swal.fire({
                  icon: 'success',
                  title: 'Succès',
                  text: 'Vos demandes de télétravail ont été soumises avec succès.',
                  confirmButtonText: 'OK',
                  timer: 3000
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                  this.resetForm();    // Clear the form
                });
              } else if (successfulRequests > 0) {
                // Some requests succeeded, some failed
                Swal.fire({
                  icon: 'warning',
                  title: 'Attention',
                  text: `${successfulRequests} demandes soumises avec succès, ${failedRequests} demandes ont échoué.`,
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                });
              } else {
                // All requests failed
                Swal.fire({
                  icon: 'error',
                  title: 'Erreur',
                  text: 'Une erreur est survenue lors de la soumission de vos demandes.',
                  confirmButtonText: 'OK'
                });
              }
            }
          },
          error: (err) => {
            console.error(`Error saving request ${index + 1}:`, err);
            completedRequests++;
            failedRequests++;
            
            // When all requests are processed, show appropriate message
            if (completedRequests === this.regularSelectedDates.length) {
              this.isSubmitting = false;
              
              if (failedRequests === this.regularSelectedDates.length) {
                // All requests failed
                Swal.fire({
                  icon: 'error',
                  title: 'Erreur',
                  text: 'Une erreur est survenue lors de la soumission de vos demandes.',
                  confirmButtonText: 'OK'
                });
              } else {
                // Some requests succeeded, some failed
                Swal.fire({
                  icon: 'warning',
                  title: 'Attention',
                  text: `${successfulRequests} demandes soumises avec succès, ${failedRequests} demandes ont échoué.`,
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.fetchRequests(); // Refresh the list
                });
              }
            }
          }
        });
      });
    } else {
      // Handle legacy single-date requests
      const request: TeletravailForm = {
        travailType: this.travailType,
        teletravailDate: this.teletravailDate || '',
        travailMaison: this.travailMaison === 'oui' ? 'true' : 'false',
        reason: isExceptional ? this.travailReason || '' : '',
        selectedPays: requiresLocation ? this.selectedPays || '' : '',
        selectedGouvernorat: requiresLocation ? this.selectedGouvernorat || '' : ''
      };
      
      console.log('Sending single request:', request);
      
      // Submit request to backend
      this.teletravailService.submitRequest(request).subscribe({
        next: (savedRequest) => {
          console.log('Request saved successfully:', savedRequest);
          this.isSubmitting = false;
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'Votre demande de télétravail a été soumise avec succès.',
            confirmButtonText: 'OK',
            timer: 3000
          }).then(() => {
            this.fetchRequests(); // Refresh the list
            this.resetForm();    // Clear the form
          });
        },
        error: (err) => {
          console.error('Error saving request:', err);
          this.isSubmitting = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Une erreur est survenue lors de la soumission de votre demande.',
            confirmButtonText: 'OK'
          });
        }
      });
    }
  }
  
  logout(): void {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      this.router.navigate(['/login']);
      console.log('Logged out successfully');
    } else {
      this.router.navigate(['/login']);
      console.log('No active session found, redirected to login');
    }
  }

  resetForm(): void {
    this.travailType = '';
    this.teletravailDate = '';
    this.travailMaison = '';
    this.selectedPays = '';
    this.selectedGouvernorat = '';
    this.reason = '';
    this.travailReason = '';
    this.travailLocation = '';
    this.filteredGouvernorats = [];
    this.isDateDisabled = false;
    this.selectedDates = [];
    this.regularSelectedDates = [];
    this.dateSelectorValue = '';
  }
  
  // Contact modal methods
  openContactModal(): void {
    this.isContactModalOpen = true;
    document.body.classList.add('modal-open');
  }

  closeContactModal(): void {
    this.isContactModalOpen = false;
    document.body.classList.remove('modal-open');
  }

  sendContactMessage(): void {
    const priority = (document.getElementById('priority') as HTMLSelectElement).value;
    const subject = (document.getElementById('subject') as HTMLInputElement).value;
    const message = (document.getElementById('message') as HTMLTextAreaElement).value;

    if (!subject || !message) {
      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'warning',
        title: 'Veuillez remplir tous les champs obligatoires',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#fff',
        iconColor: '#f39c12',
        customClass: {
          popup: 'swal-toast-popup',
          title: 'swal-toast-title'
        }
      });
      return;
    }

    const contactRequest: ContactRequest = {
      priority,
      subject,
      message,
      userEmail: this.currentUser?.email || 'anonymous@example.com',
      employeeName: this.currentUser?.firstName && this.currentUser?.lastName 
        ? `${this.currentUser.firstName} ${this.currentUser.lastName}`
        : this.currentUser?.name || 'Unknown User'
    };

    this.contactService.createContactRequest(contactRequest)
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'success',
            title: 'Votre message a été envoyé avec succès',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#fff',
            iconColor: '#7b1dbd',
            customClass: {
              popup: 'swal-toast-popup',
              title: 'swal-toast-title'
            }
          });
          this.closeContactModal();
        },
        error: (error) => {
          console.error('Error sending contact request:', error);
          Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'error',
            title: 'Une erreur est survenue lors de l\'envoi du message',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#fff',
            iconColor: '#e74c3c',
            customClass: {
              popup: 'swal-toast-popup',
              title: 'swal-toast-title'
            }
          });
        }
      });
  }

  // Profile photo methods
  toggleProfilePopup(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isProfilePopupOpen = !this.isProfilePopupOpen;
  }

  closeProfilePopup(): void {
    this.isProfilePopupOpen = false;
  }

  /**
   * Fetches all telework requests that are relevant to the current user
   */
  fetchRequests(): void {
    // Reuse existing loadRequests method
    this.loadRequests();
  }

  /**
   * Fetches the user's profile photo from the server
   * @param userId The ID of the user
   */
  private fetchProfilePhoto(userId: number): void {
    this.profileService.getUserProfilePhoto(userId).subscribe({
      next: (response) => {
        console.log('Profile photo fetched successfully:', response);
        if (response && response.photoUrl) {
          this.profilePhotoUrl = response.photoUrl;
        }
      },
      error: (error) => {
        console.error('Error fetching profile photo:', error);
        // No need to show an alert for this error as it's not user-initiated
      }
    });
  }
}
