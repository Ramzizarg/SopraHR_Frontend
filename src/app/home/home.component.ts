import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { AuthService } from '../login/AuthService';
import { Router } from '@angular/router';
import { PlanningService } from '../planning/services/planning.service';
import { formatDate } from '@angular/common';
import { ReservationService } from '../reservation/reservation.service';
import { ProfileService } from '../services/profile.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', './weekly-calendar.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  carouselData: { heading: string, strong: string }[] = [];
  isLoading: boolean = true;
  isMobileMenuOpen: boolean = false;
  isContactModalOpen: boolean = false;
  isProfilePopupOpen: boolean = false;
  
  // User info
  currentUser: any = null;
  currentDate: Date = new Date();
  formattedDate: string = '';
  greeting: string = '';
  motivationalQuote: string = '';
  profilePhotoUrl: string | null = null;
  isUploadingPhoto: boolean = false;
  
  // Work status info
  workStatus: 'teletravail' | 'office' | 'pending' | 'none' | 'weekend' = 'office';
  isWeekend: boolean = false;
  weekendMessage: string = 'Bon weekend!';
  deskReservation: { zone: string, seatNumber: string } | null = null;
  // Flag to track if we have a valid reservation from localStorage
  hasValidLocalReservation: boolean = false;
  // Flag to track if we are currently loading reservation data
  loadingReservation: boolean = true;
  // User status properties
  workLocation: string = '';
  teleworkAtHome: boolean = true;
  teleworkCountry: string = '';
  teleworkGovernorate: string = '';
  today: Date = new Date(); // Today's date for date badge
  approvalManager: string = '';
  
  // Weekly planning overview
  weekDays: Array<{
    name: string;
    date: string;
    status: 'teletravail' | 'office' | 'pending' | 'none';
    isToday: boolean;
    fullDate: Date;
  }> = [];
  
  // Planning data
  planningEntries: any[] = [];
  startDate: string = '';
  endDate: string = '';
  
  // Subscription management
  private subscriptions: Subscription[] = [];

  @ViewChild('navmenu') navMenu!: ElementRef;
  @ViewChild('mobileNavToggle') mobileNavToggle!: ElementRef;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private renderer: Renderer2,
    private planningService: PlanningService,
    private reservationService: ReservationService,
    private profileService: ProfileService
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

  // Store desk reservation in localStorage to persist across page reloads
  // Uses the user's ID as part of the key to ensure each user has their own reservation
  private saveDeskReservation(reservation: any): void {
    if (!this.currentUser?.id) {
      console.error('Cannot save desk reservation: No current user ID');
      return;
    }
    
    const storageKey = `desk_reservation_user_${this.currentUser.id}`;
    localStorage.setItem(storageKey, JSON.stringify(reservation));
    console.log(`Saved desk reservation for user ${this.currentUser.id} to localStorage:`, reservation);
  }

  private loadDeskReservation(): { zone: string, seatNumber: string } | null {
    if (!this.currentUser?.id) {
      return null;
    }
    
    const storageKey = `desk_reservation_user_${this.currentUser.id}`;
    const savedReservation = localStorage.getItem(storageKey);
    
    if (savedReservation) {
      try {
        const reservation = JSON.parse(savedReservation);
        console.log(`Loaded desk reservation for user ${this.currentUser.id} from localStorage:`, reservation);
        
        // Verify reservation is still valid for today
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if (reservation.bookingDate === today) {
          return reservation;
        } else {
          // Clear outdated reservation
          console.log('Reservation in localStorage is not for today - clearing it');
          localStorage.removeItem(storageKey);
          return null;
        }
      } catch (e) {
        console.error('Error parsing desk reservation from localStorage', e);
        // Clear invalid data
        localStorage.removeItem(storageKey);
      }
    }
    
    return null;
  }

  ngOnInit(): void {
    console.log('Home component initialized');
    
    // Update the body class for this component
    document.body.className = 'home-page';
    
    this.loadExcelData(); // Load Excel data on component init
    
    // Initialize mobile menu close on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });
    
    // Initialize hero carousel rotation
    this.initHeroCarousel();
    
    // Set up welcome header content first to ensure currentUser is available
    // This triggers the chains of methods for fetching user data
    this.setupUserInfo();
    
    this.setupDateAndGreeting();
    this.getRandomMotivationalQuote();
    
    // Initialize weekend status check immediately
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 6 for Saturday
    this.isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (this.isWeekend) {
      // Set weekend status and message immediately
      this.workStatus = 'weekend';
      this.weekendMessage = dayOfWeek === 6 ? 
        'Bon weekend! Profitez de votre samedi!' : 
        'Bon dimanche! Reposez-vous bien avant la semaine!';
      console.log('Today is weekend, setting weekend status immediately');
    }
    
    // We need to set up a one-time timeout to ensure the currentUser is loaded
    // before performing any operations that depend on user data
    setTimeout(() => {
      if (this.currentUser?.id) {
        // Setup weekly planning first to load all planning data
        this.setupWeeklyPlanning();
        
        // Then load desk reservation from localStorage if available
        const savedReservation = this.loadDeskReservation();
        if (savedReservation) {
          this.deskReservation = savedReservation;
          this.hasValidLocalReservation = true;
          console.log('Initial desk reservation loaded from localStorage:', this.deskReservation);
        }
        
        // After planning data is loaded, setup work status which uses the planning data
        // but only if it's not a weekend since we already handled that
        setTimeout(() => {
          if (!this.isWeekend) {
            this.setupWorkStatus();
          }
        }, 500); // Short delay to ensure planning data is loaded
      }
    }, 500); // Short delay to ensure currentUser is available
    
    // Add route subscription to detect when returning to the page
    const routeSubscription = this.router.events.subscribe(event => {
      // Reload data when navigating back to this component
      if (event.constructor.name === 'NavigationEnd') {
        if (this.router.url === '/' || this.router.url === '/home') {
          console.log('Navigated back to home, reloading data');
          // Reload all data when returning to home page
          if (this.currentUser?.id) {
            // CRITICAL: First get planning data to determine correct work status
            // This must be called first to ensure we have the latest planning info
            this.planningService.getUserPlanning(this.currentUser.id, this.startDate, this.endDate)
              .subscribe({
                next: (entries: any[]) => {
                  console.log(`Received ${entries?.length || 0} planning entries:`);
                  this.planningEntries = entries;
                  
                  // After we have the planning data, then load desk reservation 
                  const savedReservation = this.loadDeskReservation();
                  if (savedReservation) {
                    this.deskReservation = savedReservation;
                    this.hasValidLocalReservation = true;
                    console.log('Desk reservation restored after navigation:', this.deskReservation);
                    
                    // Reset to a welcome message instead of the URGENT message
                    this.getRandomMotivationalQuote();
                  }
                  
                  // Finally, setup work status which will use the planning data
                  // to determine whether today is telework or office
                  this.setupWorkStatus();
                },
                error: (err: any) => {
                  console.error('Error fetching planning entries:', err);
                  // Even if planning fails, we still need to setup work status
                  this.setupWorkStatus();
                }
              });
            
            // Also update weekly calendar display
            this.updateWeekDaysWithPlanningData();
          }
        }
      }
    });
    
    this.subscriptions.push(routeSubscription);
  }
  
  ngOnDestroy(): void {
    console.log('HomeComponent destroyed, cleaning up subscriptions');
    // Clean up all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
  
  // Profile popup methods
  toggleProfilePopup(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isProfilePopupOpen = !this.isProfilePopupOpen;
    
    // Close other modals if open
    if (this.isProfilePopupOpen) {
      this.isContactModalOpen = false;
    }
  }
  
  closeProfilePopup() {
    this.isProfilePopupOpen = false;
  }
  
  triggerFileInput() {
    // Trigger the hidden file input
    this.fileInput.nativeElement.click();
  }
  
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Check if file is an image
      if (!file.type.match('image.*')) {
        Swal.fire({
          toast: true,
          position: 'bottom-end',
          icon: 'warning',
          title: 'Veuillez sélectionner une image',
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
      
      // Check if we have a valid user ID
      if (this.currentUser && this.currentUser.id) {
        // Set loading state
        this.isUploadingPhoto = true;
        
        // Upload the file to the server using the ProfileService
        this.profileService.uploadProfilePhoto(this.currentUser.id, file).subscribe({
          next: (response) => {
            console.log('Profile photo uploaded successfully:', response);
            
            // If we have a photoUrl in the response, update the UI
            if (response && response.photoUrl) {
              this.profilePhotoUrl = response.photoUrl;
            }
            
            // Turn off loading state
            this.isUploadingPhoto = false;
            
            // Show success message with toast notification
            Swal.fire({
              toast: true,
              position: 'bottom-end',
              icon: 'success',
              title: 'Photo de profil mise à jour avec succès!',
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
          },
          error: (error) => {
            console.error('Error uploading profile photo:', error);
            
            // Turn off loading state
            this.isUploadingPhoto = false;
            
            // Prepare error message
            let errorMessage = 'Erreur lors du téléchargement de la photo de profil: ';
            
            if (error.status === 0) {
              errorMessage += 'Impossible de se connecter au serveur. Vérifiez votre connexion internet ou contactez l\'administrateur.';
            } else if (error.status === 403) {
              errorMessage += 'Accès non autorisé. Veuillez vous reconnecter.';
            } else if (error.status === 413) {
              errorMessage += 'Fichier trop volumineux. La taille maximale est de 10 Mo.';
            } else if (error.error && typeof error.error === 'string') {
              errorMessage += error.error;
            } else {
              errorMessage += 'Veuillez réessayer.';
            }
            
            // Show error message with toast notification
            Swal.fire({
              toast: true,
              position: 'bottom-end',
              icon: 'error',
              title: errorMessage,
              showConfirmButton: false,
              timer: 5000,
              timerProgressBar: true,
              background: '#fff',
              iconColor: '#e74c3c',
              customClass: {
                popup: 'swal-toast-popup',
                title: 'swal-toast-title'
              }
            });
          },
          complete: () => {
            // Reset the file input regardless of success or error
            this.fileInput.nativeElement.value = '';
          }
        });
      } else {
        Swal.fire({
          toast: true,
          position: 'bottom-end',
          icon: 'error',
          title: 'Utilisateur non reconnu. Veuillez vous reconnecter.',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
          background: '#fff',
          iconColor: '#e74c3c',
          customClass: {
            popup: 'swal-toast-popup',
            title: 'swal-toast-title'
          }
        });
      }
    }
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
  
  private setupUserInfo(): void {
    // Get current user info from auth service
    // Store subscription for cleanup
    const userSubscription = this.authService.currentUser.subscribe(user => {
      console.log('User data received:', user);
      this.currentUser = user;
      
      // Only fetch planning data when we have a valid user
      if (user?.id) {
        console.log('Valid user ID found, fetching planning data');
        this.setupWeeklyPlanning();
        
        // Fetch the user's profile photo
        this.fetchProfilePhoto(user.id);
      } else {
        console.log('No valid user ID yet, skipping planning data fetch');
      }
    });
    
    // Add to our subscription array for cleanup
    this.subscriptions.push(userSubscription);
  }

  private setupDateAndGreeting(): void {
    // Set up the current date
    const now = new Date();
    this.currentDate = now;
    
    // Format date as "Lundi 19 mai 2025"
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    this.formattedDate = now.toLocaleDateString('fr-FR', options);
    
    // Set appropriate greeting based on time of day
    const hour = now.getHours();
    if (hour < 12) {
      this.greeting = 'Bonjour';
    } else if (hour < 18) {
      this.greeting = 'Bon après-midi';
    } else {
      this.greeting = 'Bonsoir';
    }
  }

  private getRandomMotivationalQuote(): void {
    // Array of motivational quotes
    const quotes = [
      "La persévérance est la clé du succès.",
      "Chaque jour est une nouvelle opportunité de réussir.",
      "Les défis d'aujourd'hui sont les victoires de demain.",
      "Le succès commence par l'action.",
      "La confiance en soi est le premier secret du succès."
    ];
    
    // Choose a random quote
    const randomIndex = Math.floor(Math.random() * quotes.length);
    this.motivationalQuote = quotes[randomIndex];
  }
  
  private setupWorkStatus(): void {
    console.log('Setting up work status');
    
    // Set loading flag to true at the beginning
    this.loadingReservation = true;
    
    // Only proceed if we have a valid user
    if (!this.currentUser?.email) {
      console.log('No user found, cannot check reservation status');
      this.loadingReservation = false;
      return;
    }
    
    // Check if today is weekend (Saturday or Sunday)
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 6 for Saturday
    this.isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (this.isWeekend) {
      // Set weekend status and message
      this.workStatus = 'weekend';
      // Get a nice weekend message based on the day
      if (dayOfWeek === 6) { // Saturday
        this.weekendMessage = 'Bon weekend! Profitez de votre samedi!'; 
      } else { // Sunday
        this.weekendMessage = 'Bon dimanche! Reposez-vous bien avant la semaine!';
      }
      
      console.log('Today is weekend, setting weekend status');
      return; // Skip the rest of the method since it's weekend
    }
    
    // IMPORTANT: First ensure we have loaded desk reservation from localStorage
    // This ensures desk info is available immediately, even if API call fails
    if (!this.hasValidLocalReservation) {
      const savedReservation = this.loadDeskReservation();
      if (savedReservation) {
        this.deskReservation = savedReservation;
        this.hasValidLocalReservation = true;
        console.log('Initial desk reservation loaded from localStorage:', this.deskReservation);
      }
    } else {
      console.log('Using previously loaded desk reservation:', this.deskReservation);
    }
    
    // IMPORTANT: Check if today's status is available in weekDays array
    // This is the most reliable way to get today's status
    const todayEntry = this.weekDays.find(day => day.isToday);
    if (todayEntry) {
      console.log('Found today in weekDays array:', todayEntry);
      this.workStatus = todayEntry.status;
      console.log('Setting work status directly from weekDays to:', this.workStatus);
      
      // If we have telework status, get location details from planning entries
      if (this.workStatus === 'teletravail' && this.planningEntries && this.planningEntries.length > 0) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const planningEntry = this.planningEntries.find(e => e.date === todayStr);
        
        if (planningEntry) {
          if (planningEntry.travailMaison && planningEntry.travailMaison === 'true') {
            this.teleworkAtHome = true;
            this.workLocation = 'domicile';
          } else {
            this.teleworkAtHome = false;
            this.teleworkCountry = planningEntry.selectedPays || '';
            this.teleworkGovernorate = planningEntry.selectedGouvernorat || '';
            this.workLocation = this.teleworkCountry + (this.teleworkGovernorate ? ', ' + this.teleworkGovernorate : '');
          }
        } else {
          // Default to home if no specific location is found
          this.teleworkAtHome = true;
          this.workLocation = 'domicile';
        }
        
        // Early return since we have definitive status
        return;
      } else if (this.workStatus === 'office') {
        // Continue to reservation check below
        console.log('Today is office day, continuing to desk reservation check');
      } else {
        // Early return for pending or other status
        return;
      }
    } else {
      console.log('Could not find today in weekDays array');
    }
    
    // CRITICAL: Check if the user has any telework requests for today
    if (this.planningEntries && this.planningEntries.length > 0) {
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      console.log('Looking for planning entries for date:', todayStr);
      
      // Find today's entry in planning data
      const todayEntry = this.planningEntries.find(entry => {
        console.log('Comparing entry date:', entry.date, 'with today:', todayStr);
        return entry.date === todayStr;
      });
      
      if (todayEntry) {
        // IMPORTANT: User has a telework entry for today - this takes precedence
        console.log('Found planning entry for today:', todayEntry);
        this.workStatus = todayEntry.status;
        console.log('Setting work status to:', this.workStatus);
        this.approvalManager = todayEntry.approvalManager || 'votre responsable';
        
        // Get telework location details if available
        if (todayEntry.travailMaison && todayEntry.travailMaison === 'true') {
          this.teleworkAtHome = true;
          this.workLocation = 'domicile';
          console.log('Telework at home');
        } else {
          this.teleworkAtHome = false;
          this.teleworkCountry = todayEntry.selectedPays || '';
          this.teleworkGovernorate = todayEntry.selectedGouvernorat || '';
          this.workLocation = this.teleworkCountry + (this.teleworkGovernorate ? ', ' + this.teleworkGovernorate : '');
          console.log('Telework location:', this.workLocation);
        }
        
        // IMPORTANT: Early return to prevent office logic from running
        return;
      } else {
        console.log('No planning entry found for today');
      }
    } else {
      console.log('No planning entries available');
    }
    
    // IMPORTANT: If we have planning entries but no match for today, we need to manually
    // check if the entry exists with a different date format or representation
    if (this.planningEntries && this.planningEntries.length > 0) {
      const today = new Date();
      // Try alternative date formats that might be used in planning entries
      const todayOptions = [
        today.toISOString().split('T')[0], // YYYY-MM-DD
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, // YYYY-MM-DD manual
        `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`, // DD/MM/YYYY
        `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}` // DD/MM/YYYY padded
      ];
      
      console.log('Trying alternative date formats:', todayOptions);
      
      // Check if any entries with these date formats exist
      for (const dateFormat of todayOptions) {
        console.log('Trying date format:', dateFormat);
        const entry = this.planningEntries.find(e => {
          // Debug: log each entry's date for comparison
          console.log(`Comparing entry date '${e.date}' with '${dateFormat}'`);
          return e.date === dateFormat;
        });
        
        if (entry) {
          // Found a match with an alternative date format
          console.log('Found planning entry with alternative date format:', entry);
          this.workStatus = entry.status;
          console.log('Setting work status to:', this.workStatus);
          
          // Process telework location details
          if (entry.travailMaison && entry.travailMaison === 'true') {
            this.teleworkAtHome = true;
            this.workLocation = 'domicile';
          } else {
            this.teleworkAtHome = false;
            this.teleworkCountry = entry.selectedPays || '';
            this.teleworkGovernorate = entry.selectedGouvernorat || '';
            this.workLocation = this.teleworkCountry + (this.teleworkGovernorate ? ', ' + this.teleworkGovernorate : '');
          }
          
          // Early return to skip office setup
          return;
        }
      }
    }
    
    // If no telework request is found after all checks, default to office and check desk reservations
    console.log('No telework entry found, defaulting to office status');
    this.workStatus = 'office';
    
    // Get today's date in the format expected by the API (YYYY-MM-DD)
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    // Call the reservation service to get the desk reservation
    this.reservationService.getUserReservationsInDateRange(
      formattedDate,
      formattedDate
    ).subscribe({
      next: (reservations: any[]) => {
          console.log(`Received ${reservations?.length || 0} reservations for today:`, reservations);
          
          if (reservations && reservations.length > 0) {
            // User has a reservation for today, get the first one
            const todayReservation = reservations[0];
            console.log('Today\'s reservation details:', todayReservation);
            
            // Extract the desk ID from the reservation
            // In the backend, this is sent as 'deskId' in the ReservationDTO
            const deskId = todayReservation.deskId;
            
            if (deskId) {
              // Calculate desk zone based on desk ID (this mapping would ideally come from the backend)
              // Since we don't have that information, we'll use a simple calculation
              // In a real app, you would make an API call to get complete desk information
              
              let deskZone = 'A';
              
              // Example rule: Desk IDs 1-50 are zone A, 51-100 are zone B, 101+ are zone C
              if (deskId > 100) {
                deskZone = 'C';
              } else if (deskId > 50) {
                deskZone = 'B';
              }
              
              // Create the desk reservation with proper information
              this.deskReservation = {
                zone: deskZone,
                seatNumber: String(deskId)
              };
              
              console.log(`Found desk reservation with ID ${deskId} in zone ${deskZone}`);
              
              // Save the reservation to localStorage for persistence
              this.saveDeskReservation(this.deskReservation);
              // Set loading to false now that we have data
              this.loadingReservation = false;
            } else {
              console.warn('Reservation found but no desk ID available in the response');
              
              // Create default reservation if deskId is missing
              this.deskReservation = {
                zone: 'A',
                seatNumber: '56'
              };
              this.saveDeskReservation(this.deskReservation);
              // Set loading to false now that we have data
              this.loadingReservation = false;
            }
          } else {
            console.log('No desk reservations found in API response');
            
            // Don't show URGENT message, always display a motivational quote
            if (!this.hasValidLocalReservation) {
              console.log('No existing desk reservation found in localStorage');
              // Always show a random motivational quote even without a reservation
              this.getRandomMotivationalQuote();
            } else {
              console.log('Using existing desk reservation from localStorage:', this.deskReservation);
              // Get a random motivational quote
              this.getRandomMotivationalQuote();
            }
            // Set loading to false when no reservations are found
            this.loadingReservation = false;
          }
        },
        error: (err: any) => {
          console.error('Error fetching user reservations:', err);
          
          // Always show a motivational quote regardless of API errors
          if (!this.hasValidLocalReservation) {
            console.log('API error and no desk reservation found in localStorage');
            // Show motivational quote instead of error message
            this.getRandomMotivationalQuote();
          } else {
            console.log('API error but using existing desk reservation from localStorage:', this.deskReservation);
            // Keep existing reservation and show a motivational quote
            this.getRandomMotivationalQuote();
          }
          // Set loading to false even when there are errors
          this.loadingReservation = false;
        }
      });
  }
  
  private setupWeeklyPlanning(): void {
    // Get the current date
    const today = new Date();
    
    // Get the day of the week (0 = Sunday, 1 = Monday, ...)
    const currentDay = today.getDay();
    
    // Calculate the Monday of the week to display
    let mondayOffset;
    
    if (currentDay === 6) { // Saturday
      // For Saturday, show the next week
      mondayOffset = 2; // Monday is 2 days away
    } else if (currentDay === 0) { // Sunday
      // For Sunday, show this week (tomorrow to Friday)
      mondayOffset = 1; // Tomorrow is Monday
    } else {
      // For weekdays, show current week
      mondayOffset = 1 - currentDay; // Calculate days to Monday
    }
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0); // Set to start of day
    
    // Calculate the Friday of displayed week
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // 4 days after Monday = Friday
    friday.setHours(23, 59, 59, 999); // Set to end of day
    
    // Set date range for API call (YYYY-MM-DD format)
    this.startDate = monday.toISOString().split('T')[0];
    this.endDate = friday.toISOString().split('T')[0];
    
    // Format today's date for comparison (YYYY-MM-DD format)
    const todayStr = today.toISOString().split('T')[0];
    
    // French day names
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    
    // Create an array to hold the weekdays (Monday to Friday)
    this.weekDays = [];
    
    // First, populate with default values (all office)
    for (let i = 0; i < 5; i++) { // Monday to Friday (5 days)
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      
      // Format the date as DD/MM for display
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      // Check if this date is today by comparing year, month, and day directly
      // This avoids timezone issues that can occur with ISO string comparisons
      const isToday = date.getFullYear() === today.getFullYear() && 
                      date.getMonth() === today.getMonth() && 
                      date.getDate() === today.getDate();
      
      // Add the day to the weekDays array with default 'office' status
      this.weekDays.push({
        name: dayNames[i],
        date: formattedDate,
        status: 'office', // Default to office
        isToday: isToday,
        fullDate: new Date(date) // Store full date for comparison with planning entries
      });
    }
    
    // If we have a current user, fetch their planning data
    const userId = this.currentUser?.id;
    if (userId) {
      console.log(`Fetching planning data for user ID ${userId} from ${this.startDate} to ${this.endDate}`);
      // Unsubscribe from any existing planning subscriptions
      this.subscriptions.forEach(sub => sub.unsubscribe());
      
      // Create new subscription and store it
      const planningSubscription = this.planningService.getUserPlanning(userId, this.startDate, this.endDate)
        .subscribe({
          next: (entries) => {
            console.log(`Received ${entries.length} planning entries:`, entries);
            this.planningEntries = entries;
            
            // Update weekDays with actual planning statuses
            this.updateWeekDaysWithPlanningData();
          },
          error: (err) => {
            console.error('Error fetching planning data:', err);
          }
        });
      
      // Add to our subscription array for cleanup
      this.subscriptions.push(planningSubscription);
    }
  }
  
  /**
   * Updates the weekDays array with actual planning data from the API
   * This exactly matches the logic from PlanningComponent.getEmployeeStatusForDate
   */
  private updateWeekDaysWithPlanningData(): void {
    console.log("===== PLANNING DATA DEBUGGING =====");
    console.log("Current planning entries:", this.planningEntries);

    // Map through each day and check for planning entries
    this.weekDays = this.weekDays.map(day => {
      // Format day's date for comparison
      const dayDateStr = formatDate(day.fullDate, 'yyyy-MM-dd', 'en');
      console.log(`\n--- Processing day: ${dayDateStr} ---`);
      
      // Find a planning entry for this day
      const entry = this.planningEntries.find(entry => {
        const entryDate = formatDate(new Date(entry.planningDate), 'yyyy-MM-dd', 'en');
        const matches = entryDate === dayDateStr;
        console.log(`Comparing entry date ${entryDate} to day ${dayDateStr}: ${matches ? 'MATCH' : 'no match'}`);
        return matches;
      });
      
      if (!entry) {
        // Default to OFFICE when no entry is found (same as Planning component)
        console.log(`No entry found for ${dayDateStr}, keeping as 'office'`);
        return day;
      }
      
      console.log(`Found entry for ${dayDateStr}:`, entry);
      console.log(`Entry planningStatus: ${entry.planningStatus}`);
      console.log(`Entry workType: ${entry.workType}`);
      
      // Determine status based on the planning entry - using EXACT SAME logic as in Planning component
      let status: 'teletravail' | 'office' | 'pending' | 'none' = 'office';
      
      // Check directly for status fields first (more reliable)
      if (entry.planningStatus) {
        const entryStatus = entry.planningStatus.toUpperCase();
        console.log(`Entry has planningStatus: ${entryStatus}`);
        
        // Map according to the same rules as Planning component but be more case-tolerant
        // Check for pending/awaiting approval status
        if (entryStatus.includes('PENDING') || entryStatus.includes('EN ATTENTE') || entryStatus.includes('ATTENTE')) {
          status = 'pending';
          console.log(`Status set to 'pending' because planningStatus is ${entryStatus}`);
        } 
        // Check for approved/teletravail status with better case handling
        else if (
          entryStatus.includes('APPROVED') || 
          entryStatus.includes('TELETRAVAIL') || 
          entryStatus.includes('TÉLÉTRAVAIL') ||
          entryStatus.includes('TELETRAVA') ||
          entryStatus.includes('APPROU') ||
          entryStatus.includes('APPROUV')
        ) {
          status = 'teletravail';
          console.log(`Status set to 'teletravail' because planningStatus is ${entryStatus}`);
        } else {
          console.log(`planningStatus ${entryStatus} did not match any known status conditions`);
        }
      } else {
        console.log('No planningStatus field, checking workType');
        
        // If no explicit status, check work type (same as Planning component)
        if (entry.workType === 'Regular' || entry.workType === 'Exceptional') {
          // Default teletravail entry to TELETRAVAIL if no other status is set
          status = 'teletravail';
          console.log(`Status set to 'teletravail' because workType is ${entry.workType}`);
        } else if (entry.workType === 'Office') {
          status = 'office';
          console.log(`Status set to 'office' because workType is ${entry.workType}`);
        } else if (entry.workType === 'Vacation' || entry.workType === 'Holiday') {
          status = 'none';
          console.log(`Status set to 'none' because workType is ${entry.workType}`);
        } else {
          console.log(`workType ${entry.workType} did not match any known status conditions`);
        }
      }
      
      console.log(`FINAL STATUS for ${dayDateStr}: ${status}`);
      
      // Return updated day with the correct status
      return {
        ...day,
        status: status,
        fullDate: day.fullDate // Ensure fullDate is preserved
      };
    });
    
    console.log("Final weekDays array:", this.weekDays);
  }
  
  // Navigate to the weekly planning page
  goToWeeklyPlanning(): void {
    // Navigate to the planning page
    this.router.navigate(['/planning']);
  }
  
  private initHeroCarousel(): void {
    // Update z-index of overlay to ensure it's visible
    const heroOverlay = document.querySelector('.hero-overlay') as HTMLElement;
    if (heroOverlay) {
      heroOverlay.style.zIndex = '100';
    }
    
    // Preload all images to prevent flickering
    this.preloadCarouselImages();
    
    // Set up carousel rotation with smoother transitions
    setInterval(() => {
      const carouselItems = document.querySelectorAll('.hero-carousel .carousel-item');
      if (carouselItems.length > 0) {
        let activeIndex = -1;
        
        // Find the current active item
        carouselItems.forEach((item, index) => {
          if (item.classList.contains('active')) {
            activeIndex = index;
          }
        });
        
        // Calculate the next index with wrapping
        const nextIndex = (activeIndex + 1) % carouselItems.length;
        
        // Prepare next item to be immediately visible but transparent
        const nextItem = carouselItems[nextIndex] as HTMLElement;
        nextItem.style.transition = 'opacity 0.8s ease-in-out';
        nextItem.style.opacity = '0';
        nextItem.classList.add('active');
        
        // Short delay to ensure browser properly processes the changes
        setTimeout(() => {
          // Rapidly fade out current item while fading in next item simultaneously
          const currentItem = carouselItems[activeIndex] as HTMLElement;
          currentItem.style.transition = 'opacity 0.8s ease-in-out';
          currentItem.style.opacity = '0';
          nextItem.style.opacity = '1';
          
          // Remove active class from old item after transition completes
          setTimeout(() => {
            currentItem.classList.remove('active');
          }, 800);
        }, 50);
      }
    }, 7000); // Change image every 7 seconds for more dynamic experience
  }
  
  // Preload all carousel images to prevent flickering and grid patterns
  private preloadCarouselImages(): void {
    // Get all carousel items
    const carouselItems = document.querySelectorAll('.hero-carousel .carousel-item');
    
    // Create a promise array to track all image loads
    const preloadPromises: Promise<unknown>[] = [];
    
    carouselItems.forEach(item => {
      const bgImage = (item as HTMLElement).style.backgroundImage;
      if (bgImage) {
        const imageUrl = bgImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
        
        // Create a promise for each image load
        const promise = new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = imageUrl;
        });
        
        preloadPromises.push(promise);
      }
    });
    
    // Apply additional hardware acceleration to all carousel items
    Promise.all(preloadPromises).then(() => {
      carouselItems.forEach(item => {
        // Force hardware acceleration and prevent grid patterns
        (item as HTMLElement).style.transform = 'translate3d(0, 0, 0)';
      });
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

  loadExcelData(): void {
    fetch('./assets/Phrases_Motivation.xlsx') // Path to the Excel file
      .then(response => response.arrayBuffer()) // Convert the response to ArrayBuffer
      .then(data => {
        const workbook = XLSX.read(data, { type: 'array' }); // Read the Excel file
        const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Select the first sheet
        const rows: any[] = XLSX.utils.sheet_to_json(sheet); // Convert sheet to JSON

        // Map the data to format suitable for the carousel
        this.carouselData = rows.slice(0, 3).map(row => ({
          heading: row['Heading']?.trim() || 'Titre non disponible', // Default if missing
          strong: row['Strong']?.trim() || 'Texte non disponible'   // Default if missing
        }));

        // Ensure that at least 3 entries are available
        if (this.carouselData.length < 3) {
          console.error("Le fichier Excel doit contenir au moins 3 entrées");
          this.setDefaultMessages(); // Use default messages if less than 3 entries
        }

        this.isLoading = false; // Disable loading indicator
      })
      .catch(error => {
        console.error("Erreur de chargement du fichier Excel:", error);
        this.setDefaultMessages(); // Fallback to default messages in case of error
        this.isLoading = false;
      });
  }

  private setDefaultMessages(): void {
    // Default messages when the file is missing or incomplete
    this.carouselData = [
      { heading: 'Force intérieure', strong: 'Croyez en votre potentiel' },
      { heading: 'Dépassement de soi', strong: 'Chaque défi est une opportunité' },
      { heading: 'Victoire assurée', strong: 'Votre succès commence ici' }
    ];
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Contact modal methods
  openContactModal() {
    this.isContactModalOpen = true;
    document.body.classList.add('modal-open');
  }

  closeContactModal() {
    this.isContactModalOpen = false;
    document.body.classList.remove('modal-open');
  }

  sendContactMessage() {
    alert('Votre message a été envoyé. Nous vous contacterons bientôt.');
    this.closeContactModal();
  }
}
