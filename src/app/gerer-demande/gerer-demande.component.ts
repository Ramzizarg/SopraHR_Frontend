import { Component, OnInit, ViewChild, ElementRef, Renderer2, OnDestroy, AfterViewInit, HostListener } from '@angular/core';
import { AuthService } from '../login/AuthService';
import { PlanningService } from '../planning/services/planning.service';
import { PlanningResponse, TeletravailRequest } from '../planning/models/planning.model';
import { ProfileService } from '../services/profile.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { Subject, Observable, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ContactService, ContactRequest } from '../services/contact.service';
import { NotificationService, Notification } from '../services/notification.service';

@Component({
  selector: 'app-gerer-demande',
  templateUrl: './gerer-demande.component.html',
  styleUrls: ['./gerer-demande.component.css', '../shared/header-footer.css']
})
export class GererDemandeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('navmenu') navMenu!: ElementRef;
  @ViewChild('mobileNavToggle') mobileNavToggle!: ElementRef;
  @ViewChild('container') container!: ElementRef;

  isManager: boolean = false;
  isTeamLeader: boolean = false;
  currentUserId = 0;
  currentTeamId: number = 0;
  currentTeamName: string = '';
  error = '';
  isMobileMenuOpen: boolean = false;
  isContactModalOpen: boolean = false;
  isSearchFilterSticky: boolean = false;
  private destroy$ = new Subject<void>();

  // Request management
  allRequests: TeletravailRequest[] = [];
  filteredRequests: TeletravailRequest[] = [];
  private searchTermSubject = new Subject<string>();
  
  private _searchTerm: string = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(value: string) {
    this._searchTerm = value;
    this.searchTermSubject.next(value);
  }

  selectedType: string = 'all';
  selectAll: boolean = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  allFilteredRequests: TeletravailRequest[] = [];

  notifications: Notification[] = [];
  unreadCount: number = 0;
  showNotifications: boolean = false;

  constructor(
    private authService: AuthService,
    private planningService: PlanningService,
    private renderer: Renderer2,
    private router: Router,
    private profileService: ProfileService,
    private http: HttpClient,
    private contactService: ContactService,
    private notificationService: NotificationService
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
    // Subscribe to auth changes to ensure we have user data before loading
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.isManager = this.authService.isManager();
        this.isTeamLeader = this.authService.isTeamLeader();
        this.currentUserId = user.id;
        
        // Get team information if available
        if (user.team) {
          this.currentTeamName = user.team;
          this.currentTeamId = this.getTeamIdFromName(user.team);
        }
        
        // Load pending requests
        this.loadPendingRequests();

        this.notificationService.getUserNotifications(user.id).subscribe({
          next: (notifications) => {
            this.notifications = notifications;
          },
          error: (err) => {
            console.error('Error fetching notifications:', err);
          }
        });
        this.notificationService.getUnreadNotificationCount(user.id).subscribe({
          next: (count) => {
            this.unreadCount = count;
          },
          error: (err) => {
            console.error('Error fetching unread notification count:', err);
          }
        });
      }
    });

    // Initialize mobile menu close on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });

    // Debounce search term changes
    this.searchTermSubject.pipe(
      debounceTime(300), // Wait for 300ms after the last keystroke
      distinctUntilChanged(), // Only emit if the value has changed
    ).subscribe(() => {
      this.filterRequests();
    });
  }

  ngAfterViewInit() {
    this.initializeAnimations();
  }

  private initializeAnimations() {
    // Initialize AOS (Animate On Scroll)
    const elements = document.querySelectorAll('[data-aos]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const animation = element.getAttribute('data-aos') || 'fade-up';
          const delay = element.getAttribute('data-aos-delay') || '0';
          
          element.style.opacity = '0';
          element.style.transform = 'translateY(20px)';
          
          setTimeout(() => {
            element.style.transition = 'all 0.6s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
          }, parseInt(delay));
          
          observer.unobserve(element);
        }
      });
    }, {
      threshold: 0.1
    });

    elements.forEach(element => observer.observe(element));
  }

  // Mobile menu handling
  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (this.isMobileMenuOpen) {
      document.body.classList.add('mobile-nav-active');
    } else {
      document.body.classList.remove('mobile-nav-active');
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    document.body.classList.remove('mobile-nav-active');
  }

  // Contact modal handling
  openContactModal(): void {
    this.isContactModalOpen = true;
    this.showNotifications = false;
    document.body.style.overflow = 'hidden';
  }

  closeContactModal(): void {
    this.isContactModalOpen = false;
    document.body.style.overflow = '';
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

    // Get current user from authService
    this.authService.currentUser.subscribe(user => {
      const contactRequest: ContactRequest = {
        priority,
        subject,
        message,
        userEmail: user?.email || 'anonymous@example.com',
        employeeName: user?.firstName && user?.lastName 
          ? `${user.firstName} ${user.lastName}`
          : 'Unknown User'
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
    });
  }

  // Request management
  loadPendingRequests(): void {
    // Get current date and end of month
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Format dates as YYYY-MM-DD
    const startDate = today.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    if (this.isManager) {
      // Managers see all requests except their own
      this.planningService.getAllPlanning(startDate, endDate).subscribe({
        next: (planningData: PlanningResponse[]) => {
          // Filter for pending requests, exclude own requests, and map to TeletravailRequest
          this.allRequests = planningData
            .filter(entry => entry.planningStatus === 'PENDING' && entry.userId !== this.currentUserId)
            .map(entry => ({
              id: entry.id,
              userId: entry.userId,
              userName: entry.userName,
              employeeName: entry.employeeName,
              team: entry.team || '',
              role: entry.role, // Temporarily assign raw role
              teamLeaderId: 0,
              teletravailDate: entry.planningDate,
              travailType: this.mapWorkType(entry.workType),
              travailMaison: entry.location === 'Domicile' ? 'oui' : 'non',
              reason: entry.reasons,
              status: 'PENDING',
              createdAt: entry.createdAt,
              profilePhotoUrl: undefined,
              selected: false
            }));

          // Fetch profile photos and roles for each request and wait for all to complete
          const profileFetches: Observable<any>[] = [];
          this.allRequests.forEach(request => {
            if (request.userId) {
              profileFetches.push(
                this.profileService.getUserProfilePhoto(request.userId).pipe(
                  tap((response: { photoUrl: string }) => {
                    if (response && response.photoUrl) {
                      request.profilePhotoUrl = response.photoUrl;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching profile photo:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                ),
                this.fetchUserRole(request.userId).pipe(
                  tap((userData: any) => {
                    if (userData && userData.role) {
                      request.role = userData.role;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching user role:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                )
              );
            }
          });

          if (profileFetches.length > 0) {
            forkJoin(profileFetches).subscribe({
              next: () => {
                this.filterRequests();
              },
              error: (error) => {
                console.error('Error fetching profiles/roles:', error);
                this.error = 'Erreur lors du chargement des informations utilisateur.';
                this.filterRequests(); // Still attempt to filter even if some failed
              }
            });
          } else {
            this.filterRequests(); // No profiles to fetch, just filter
          }
        },
        error: (error) => {
          console.error('Error loading requests:', error);
          this.error = 'Erreur lors du chargement des demandes.';
        }
      });
    } else if (this.isTeamLeader) {
      // Team leaders see only their team's requests except their own
      this.planningService.getTeamPlanning(this.currentTeamName, startDate, endDate).subscribe({
        next: (planningData: PlanningResponse[]) => {
          // Filter for pending requests, exclude own requests, and map to TeletravailRequest
          this.allRequests = planningData
            .filter(entry => entry.planningStatus === 'PENDING' && entry.userId !== this.currentUserId)
            .map(entry => ({
              id: entry.id,
              userId: entry.userId,
              userName: entry.userName,
              employeeName: entry.employeeName,
              team: entry.team || '',
              role: entry.role, // Temporarily assign raw role
              teamLeaderId: 0,
              teletravailDate: entry.planningDate,
              travailType: this.mapWorkType(entry.workType),
              travailMaison: entry.location === 'Domicile' ? 'oui' : 'non',
              reason: entry.reasons,
              status: 'PENDING',
              createdAt: entry.createdAt,
              profilePhotoUrl: undefined,
              selected: false
            }));

          // Fetch profile photos and roles for each request and wait for all to complete
          const profileFetches: Observable<any>[] = [];
          this.allRequests.forEach(request => {
            if (request.userId) {
              profileFetches.push(
                this.profileService.getUserProfilePhoto(request.userId).pipe(
                  tap((response: { photoUrl: string }) => {
                    if (response && response.photoUrl) {
                      request.profilePhotoUrl = response.photoUrl;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching profile photo:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                ),
                this.fetchUserRole(request.userId).pipe(
                  tap((userData: any) => {
                    if (userData && userData.role) {
                      request.role = userData.role;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching user role:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                )
              );
            }
          });

          if (profileFetches.length > 0) {
            forkJoin(profileFetches).subscribe({ 
              next: () => {
                this.filterRequests();
              },
              error: (error) => {
                console.error('Error fetching profiles/roles:', error);
                this.error = 'Erreur lors du chargement des informations utilisateur.';
                this.filterRequests(); // Still attempt to filter even if some failed
              }
            });
          } else {
            this.filterRequests(); // No profiles to fetch, just filter
          }
        },
        error: (error) => {
          console.error('Error loading team requests:', error);
          this.error = 'Erreur lors du chargement des demandes de l\'équipe.';
        }
      });
    } else {
      // Regular users see only their own requests
      this.planningService.getUserPlanning(this.currentUserId, startDate, endDate).subscribe({
        next: (planningData: PlanningResponse[]) => {
          this.allRequests = planningData
            .filter(entry => entry.planningStatus === 'PENDING')
            .map(entry => ({
              id: entry.id,
              userId: entry.userId,
              userName: entry.userName,
              employeeName: entry.employeeName,
              team: entry.team || '',
              role: entry.role, // Temporarily assign raw role
              teamLeaderId: 0,
              teletravailDate: entry.planningDate,
              travailType: this.mapWorkType(entry.workType),
              travailMaison: entry.location === 'Domicile' ? 'oui' : 'non',
              reason: entry.reasons,
              status: 'PENDING',
              createdAt: entry.createdAt,
              profilePhotoUrl: undefined,
              selected: false
            }));

          // Fetch profile photos and roles for each request and wait for all to complete
          const profileFetches: Observable<any>[] = [];
          this.allRequests.forEach(request => {
            if (request.userId) {
              profileFetches.push(
                this.profileService.getUserProfilePhoto(request.userId).pipe(
                  tap((response: { photoUrl: string }) => {
                    if (response && response.photoUrl) {
                      request.profilePhotoUrl = response.photoUrl;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching profile photo:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                ),
                this.fetchUserRole(request.userId).pipe(
                  tap((userData: any) => {
                    if (userData && userData.role) {
                      request.role = userData.role;
                    }
                  }),
                  catchError((error: Error) => {
                    console.error('Error fetching user role:', error);
                    return of(null); // Return null on error to let forkJoin continue
                  })
                )
              );
            }
          });

          if (profileFetches.length > 0) {
            forkJoin(profileFetches).subscribe({
              next: () => {
                this.filterRequests();
              },
              error: (error) => {
                console.error('Error fetching profiles/roles:', error);
                this.error = 'Erreur lors du chargement des informations utilisateur.';
                this.filterRequests(); // Still attempt to filter even if some failed
              }
            });
          } else {
            this.filterRequests(); // No profiles to fetch, just filter
          }
        },
        error: (error) => {
          console.error('Error loading user requests:', error);
          this.error = 'Erreur lors du chargement de vos demandes.';
        }
      });
    }
  }

  filterRequests(): void {
    // First filter the requests
    this.allFilteredRequests = this.allRequests.filter(request => {
      const matchesSearchTerm = this.searchTerm === '' ||
        request.userName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        request.team.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        request.travailType.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = this.selectedType === 'all' || request.travailType === this.selectedType;

      // Add role filter for team leaders
      const matchesRole = this.isTeamLeader ? 
        (request.role?.toUpperCase() === 'EMPLOYEE') : true;

      return matchesSearchTerm && matchesType && matchesRole;
    });

    // Update pagination after filtering
    this.currentPage = 1;
    this.updatePagination();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.allFilteredRequests.length / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.filteredRequests = this.allFilteredRequests.slice(startIndex, endIndex);
  }

  approveRequest(request: TeletravailRequest): void {
    Swal.fire({
      title: 'Approuver la demande',
      text: `Voulez-vous approuver la demande de télétravail pour ${request.employeeName || request.userName} ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, approuver',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.planningService.approveTeletravailRequest(request.id).subscribe({
          next: () => {
            this.loadPendingRequests();
            Swal.fire({
              icon: 'success',
              title: 'Demande approuvée',
              text: 'La demande a été approuvée avec succès.',
              confirmButtonText: 'OK'
            });
          },
          error: (err: Error) => {
            this.error = 'Erreur lors de l\'approbation de la demande';
            console.error('Error approving request:', err);
          }
        });
      }
    });
  }

  rejectRequest(request: TeletravailRequest): void {
    Swal.fire({
      title: 'Refuser la demande',
      text: 'Veuillez indiquer la raison du refus :',
      input: 'textarea',
      inputPlaceholder: 'Raison du refus...',
      showCancelButton: true,
      confirmButtonText: 'Refuser',
      cancelButtonText: 'Annuler',
      inputValidator: (value) => {
        if (!value) {
          return 'La raison du refus est requise';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.planningService.rejectTeletravailRequest(request.id, result.value).subscribe({
          next: () => {
            this.loadPendingRequests();
            Swal.fire({
              icon: 'success',
              title: 'Demande refusée',
              text: 'La demande a été refusée avec succès.',
              confirmButtonText: 'OK'
            });
          },
          error: (err: Error) => {
            this.error = 'Erreur lors du refus de la demande';
            console.error('Error rejecting request:', err);
          }
        });
      }
    });
  }

  // Helper methods
  getTeamIdFromName(teamName: string): number {
    // Implement team ID mapping logic
    const teamMap: { [key: string]: number } = {
      'DEV': 1,
      'QA': 2,
      'OPS': 3
    };
    return teamMap[teamName] || 0;
  }

  getTypeLabel(type: string): string {
    return type === 'Régulière' ? 'Régulière' : 'Exceptionnelle';
  }

  // Helper method to map work type to French values
  private mapWorkType(workType: string): string {
    const normalizedType = workType.toLowerCase();
    if (normalizedType === 'regular' || normalizedType === 'régulier' || normalizedType === 'régulière' || normalizedType === 'reguliere') {
      return 'Régulière';
    } else if (normalizedType === 'exceptional' || normalizedType === 'exceptionnel' || normalizedType === 'exceptionnelle') {
      return 'Exceptionnelle';
    }
    // Default to Régulière if type is not recognized
    return 'Régulière';
  }

  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';
    const parentElement = imgElement.parentElement;
    if (parentElement) {
      const fallbackDiv = parentElement.querySelector('.avatar-circle') as HTMLElement;
      if (fallbackDiv) {
        fallbackDiv.style.display = 'flex';
      }
    }
  }

  toggleSelectAll(): void {
    this.filteredRequests.forEach(request => {
      request.selected = this.selectAll;
    });
  }

  updateSelectAllState(): void {
    this.selectAll = this.filteredRequests.length > 0 && 
      this.filteredRequests.every(request => request.selected);
  }

  hasSelectedRequests(): boolean {
    return this.filteredRequests.some(request => request.selected);
  }

  getSelectedRequests(): TeletravailRequest[] {
    return this.filteredRequests.filter(request => request.selected);
  }

  approveSelected(): void {
    const selectedRequests = this.getSelectedRequests();
    if (selectedRequests.length === 0) return;

    Swal.fire({
      title: 'Approuver les demandes',
      text: `Voulez-vous approuver ${selectedRequests.length} demande(s) de télétravail ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, approuver',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        const approvePromises = selectedRequests.map(request => 
          this.planningService.approveTeletravailRequest(request.id).toPromise()
        );

        Promise.all(approvePromises)
          .then(() => {
            this.loadPendingRequests();
            Swal.fire({
              icon: 'success',
              title: 'Demandes approuvées',
              text: `${selectedRequests.length} demande(s) ont été approuvées avec succès.`,
              confirmButtonText: 'OK'
            });
          })
          .catch((err) => {
            this.error = 'Erreur lors de l\'approbation des demandes';
            console.error('Error approving requests:', err);
          });
      }
    });
  }

  rejectSelected(): void {
    const selectedRequests = this.getSelectedRequests();
    if (selectedRequests.length === 0) return;

    Swal.fire({
      title: 'Refuser les demandes',
      text: 'Veuillez indiquer la raison du refus :',
      input: 'textarea',
      inputPlaceholder: 'Raison du refus...',
      showCancelButton: true,
      confirmButtonText: 'Refuser',
      cancelButtonText: 'Annuler',
      inputValidator: (value) => {
        if (!value) {
          return 'La raison du refus est requise';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const rejectPromises = selectedRequests.map(request => 
          this.planningService.rejectTeletravailRequest(request.id, result.value).toPromise()
        );

        Promise.all(rejectPromises)
          .then(() => {
            this.loadPendingRequests();
            Swal.fire({
              icon: 'success',
              title: 'Demandes refusées',
              text: `${selectedRequests.length} demande(s) ont été refusées avec succès.`,
              confirmButtonText: 'OK'
            });
          })
          .catch((err) => {
            this.error = 'Erreur lors du refus des demandes';
            console.error('Error rejecting requests:', err);
          });
      }
    });
  }

  getTeamColorClass(team: string): string {
    switch (team?.toUpperCase()) {
      case 'DEV':
        return 'bg-primary'; // Blue
      case 'QA':
        return 'bg-success'; // Green
      case 'OPS':
        return 'bg-info'; // Light blue
      default:
        return 'bg-secondary'; // Gray
    }
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getRoleLabel(role: string | undefined): string {
    // If no role is provided or role is empty, return 'Non défini'
    if (!role || role.trim() === '') return 'Non défini';
    
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

  getRoleClass(role: string | undefined): string {
    if (!role) return '';
    const normalizedRole = role.toUpperCase();
    switch (normalizedRole) {
      case 'MANAGER':
        return 'role-manager';
      case 'EMPLOYEE':
        return 'role-employee';
      case 'TEAM_LEADER':
        return 'role-team-leader';
      case 'ADMIN':
        return 'role-admin';
      default:
        return '';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTermSubject.complete(); // Complete the subject on destroy
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    // Adjust this value based on when you want the section to become sticky
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.isSearchFilterSticky = scrollPosition > 150; // Example: becomes sticky after scrolling 150px
  }

  // Add method to fetch user role from users API
  private fetchUserRole(userId: number) {
    return this.http.get<any>(`http://localhost:9001/api/users/${userId}`);
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.isContactModalOpen = false;
    }
  }

  handleNotificationClick(notif: Notification) {
    this.notificationService.markAsRead(notif.id).subscribe({
      next: (notification) => {
        const idx = this.notifications.findIndex(n => n.id === notif.id);
        if (idx !== -1) {
          this.notifications[idx] = notification;
        }
        if (this.unreadCount > 0) {
          this.unreadCount--;
        }
      },
      error: (err) => {
        console.error('Error marking notification as read:', err);
      }
    });
    if (notif.type === 'TELEWORK_REQUEST_CREATED') {
      this.router.navigate(['/planning']);
      this.showNotifications = false;
    }
  }

  onProfilePopupOpened() {
    this.showNotifications = false;
  }
}
