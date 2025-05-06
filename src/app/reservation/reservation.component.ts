import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { fromEvent, Subscription, takeUntil, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService, Desk as ApiDesk, Plan as ApiPlan, Wall as ApiWall, Reservation } from './reservation.service';
import { AuthService, UserProfile } from '../login/AuthService';
import Swal from 'sweetalert2';

export interface Desk {
  id: number;
  left: number;
  top: number;
  rotation: number;
  moving?: boolean;
  available?: boolean; // True if available, false if reserved
  employeeName?: string;
  duration?: '4' | '8'; // 4 for half day, 8 for full day
  bookingDate?: string;
  isOwnReservation?: boolean;
}

export interface Wall {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  element?: HTMLElement;
  sizeIndicator?: HTMLElement;
  resizing?: boolean;
  moving?: boolean;
  status?: 'available' | 'reserved';
}

export interface Plan {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  desks: Desk[];
  walls: Wall[];
}

@Component({
  selector: 'app-reservation',
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.css']
})
export class ReservationComponent implements OnInit {
  private currentUser: UserProfile | null = null;
  public isManager: boolean = false;
  @ViewChild('designContainer', { static: true }) designContainer!: ElementRef<HTMLElement>;
  @ViewChild('statusBar', { static: true }) statusBar!: ElementRef<HTMLElement>;
  
  public plans: Plan[] = [];
  public currentPlan: Plan | null = null;
  public selectedPlan: Plan | null = null;
  public selectedDesk: Desk | null = null;
  public selectedWall: Wall | null = null;
  public isPlanConfirmed = false;
  public isSidebarVisible = true; // Always visible now
  public isLoading: boolean = false;
  public resizeHandles = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'];

  private readonly GRID_SIZE = 10;
  private readonly INITIAL_WIDTH = 400;
  private readonly INITIAL_HEIGHT = 300;
  private readonly DESK_WIDTH = 15;
  private readonly DESK_HEIGHT = 50;
  private readonly WALL_SIZE = 20;
  private readonly KEYBOARD_MOVE_SPEED = 10;
  private readonly MIN_PLAN_SIZE = 100;

  // Add new constant for minimum plan dimensions based on desk size
  private readonly MIN_PLAN_WIDTH = Math.max(100, this.DESK_WIDTH + 20); // desk width plus padding
  private readonly MIN_PLAN_HEIGHT = Math.max(100, this.DESK_HEIGHT + 20); // desk height plus padding

  private planCounter = 0;
  private dragSubscription: Subscription | null = null;
  private resizeSubscription: Subscription | null = null;
  private keyState: { [key: string]: boolean } = {};
  private moveInterval: ReturnType<typeof setInterval> | null = null;
  private startX: number = 0;
  private startY: number = 0;
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private resizeHandle: string = '';
  private activePlan: Plan | null = null;

  public showBookingDialog = false;
  public selectedDeskForBooking: Desk | null = null;
  public employeeName = '';
  public bookingDuration: '4' | '8' = '4';
  public currentDate = '';

  private readonly MAX_FUTURE_DAYS = 14; // Maximum two weeks in the future
  private readonly MAX_PAST_DAYS = 0;    // No past days allowed

  public viewMode: 'week' | 'day' = 'day';
  public weekDates: string[] = [];
  public selectedWeekDates: Set<string> = new Set();
  public selectedBookingDates: Set<string> = new Set();
  public bookingWeekDates: string[] = [];
  // Store reservations by date for easy lookup
  public reservationsByDate: Map<string, Reservation[]> = new Map<string, Reservation[]>();
  router: any;

  // Add private property to store the resize handler reference
  private resizeHandler = () => {
    this.syncContainerWidths();
    this.updateContainerWidths();
  };

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.setupKeyboardListeners();
    this.syncContainerWidths();
    this.setupDocumentClickHandler();
    
    // Add resize event listener to handle container size on viewport changes
    window.addEventListener('resize', this.resizeHandler);
    
    // Add specific event listener for when dev tools are closed
    this.setupDevToolsCloseListener();

    // Check if the user is a manager
    this.authService.currentUser.subscribe({
      next: (user: UserProfile | null) => {
        if (user) {
          this.currentUser = user;
          // Set isManager flag based on user role
          this.isManager = user.role === 'MANAGER' || user.role === 'ROLE_MANAGER';
          console.log('User has manager role:', this.isManager);
          
          // Update layout after role is determined
          setTimeout(() => {
            this.syncContainerWidths();
            this.updateContainerWidths();
          }, 0);
        }
      },
      error: (error: any) => {
        console.error('Error getting current user:', error);
      }
    });

    // Set initial date to today or next business day if today is weekend
    const today = new Date();
    let initialDate = new Date(today);
    if (this.isWeekend(today)) {
      initialDate = this.getNextBusinessDay(today);
    }
    const year = initialDate.getFullYear();
    const month = String(initialDate.getMonth() + 1).padStart(2, '0');
    const day = String(initialDate.getDate()).padStart(2, '0');
    this.currentDate = `${year}-${month}-${day}`;
    this.selectedWeekDates.add(this.currentDate);
    this.updateWeekDates();
    
    // Load plans from API
    this.loadPlans();
  }
  
  /**
   * Cleanup resources when component is destroyed
   */
  ngOnDestroy(): void {
    // Clean up all event listeners using the stored reference
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clear subscriptions
    if (this.dragSubscription) {
      this.dragSubscription.unsubscribe();
    }
    
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    
    // Clear intervals
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
    }
  }
  
  // Background image rotation is now handled by CSS

  private syncContainerWidths(): void {
    if (this.designContainer && this.statusBar) {
      // Ensure the widths of the design container and status bar are in sync
      const containerRect = this.designContainer.nativeElement.getBoundingClientRect();
      const exactWidth = containerRect.width;
      
      // Set exact pixel width to ensure they match perfectly
      this.statusBar.nativeElement.style.width = `${exactWidth}px`;
      
      // Force a repaint to ensure dimensions update correctly
      this.forceRepaint(this.designContainer.nativeElement);
      this.forceRepaint(this.statusBar.nativeElement);
      
      console.log('Synchronized widths - Design Container:', exactWidth, 'Status Bar:', this.statusBar.nativeElement.offsetWidth);
    }
  }

  private updateContainerWidths(): void {
    if (this.designContainer && this.statusBar) {
      const container = this.designContainer.nativeElement;
      const statusBar = this.statusBar.nativeElement;
      
      // Get the computed style to use consistent sizing
      const containerWidth = container.offsetWidth;
      statusBar.style.width = `${containerWidth}px`;
      
      if (!this.isManager) {
        // For non-managers with hidden sidebar
        container.style.marginLeft = 'auto';
        container.style.marginRight = 'auto';
        statusBar.style.marginLeft = 'auto';
        statusBar.style.marginRight = 'auto';
      } else {
        // For managers with visible sidebar
        container.style.marginLeft = '340px';
        container.style.marginRight = '';
        statusBar.style.marginLeft = '340px';
        statusBar.style.marginRight = '';
      }
      
      // Force repaint after changes
      this.forceRepaint(container);
      this.forceRepaint(statusBar);
    }
  }

  private loadPlans(): void {
    this.isLoading = true;
    this.reservationService.getPlans().subscribe({
      next: (apiPlans) => {
        if (apiPlans.length > 0) {
          // The backend should only have one plan according to business rule
          const apiPlan = apiPlans[0];
          
          // Convert API plan to frontend plan format
          const plan: Plan = {
            id: apiPlan.id?.toString() || `plan-${++this.planCounter}`,
            left: apiPlan.left || 50, // Use stored position if available
            top: apiPlan.top || 50,   // Use stored position if available
            width: apiPlan.width || this.INITIAL_WIDTH,
            height: apiPlan.height || this.INITIAL_HEIGHT,
            desks: [],
            walls: []
          };
          
          this.plans = [plan];
          this.currentPlan = plan;
          this.selectedPlan = null; // Don't automatically select the plan
          this.isPlanConfirmed = true; // Plans from server are always confirmed
          
          // Load desks and walls for this plan
          this.loadDesksAndWalls(apiPlan.id!);
        } else {
          // No plans found, allow creating one if user is manager
          if (this.authService.isManager()) {
            this.createPlan();
          } else {
            Swal.fire({
              title: 'No Floor Plans Available',
              text: 'Please contact a manager to create a floor plan.',
              icon: 'info',
              confirmButtonText: 'OK'
            });
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load plans', error);
        Swal.fire({
          title: 'Error Loading Plans',
          text: `Error: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        this.isLoading = false;
      }
    });
  }

  private loadDesksAndWalls(planId: number): void {
    if (!this.currentPlan) return;
    
    this.isLoading = true;
    
    // Load desks
    this.reservationService.getDesksByPlanId(planId).subscribe({
      next: (apiDesks) => {
        // Convert API desks to frontend format
        this.currentPlan!.desks = apiDesks.map(apiDesk => ({
          id: apiDesk.id,
          left: apiDesk.left,
          top: apiDesk.top,
          rotation: apiDesk.rotation,
          available: apiDesk.available // Use the available property directly
        }));
        
        // Load walls
        this.reservationService.getWallsByPlanId(planId).subscribe({
          next: (apiWalls) => {
            // Convert API walls to frontend format
            this.currentPlan!.walls = apiWalls.map(apiWall => ({
              id: apiWall.id?.toString() || apiWall.wallId || `wall-${Date.now()}`, // Ensure id is always a string
              left: apiWall.left,
              top: apiWall.top,
              width: apiWall.width,
              height: apiWall.height
            }));
            
            // Load reservations for the current date
            this.loadReservationsForCurrentView();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Failed to load walls', error);
            Swal.fire({
              title: 'Error Loading Walls',
              text: `Error: ${error.message}`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
            this.isLoading = false;
          }
        });
      },
      error: (error) => {
        console.error('Failed to load desks', error);
        Swal.fire({
          title: 'Error Loading Desks',
          text: `Error: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        this.isLoading = false;
      }
    });
  }

  private loadReservationsForCurrentView(): void {
    if (!this.currentPlan) return;
    
    this.isLoading = true;
    
    if (this.viewMode === 'day') {
      // Load reservations for the current date
      this.reservationService.getReservationsByDate(this.currentDate).subscribe({
        next: (reservations) => {
          this.updateDeskReservations(reservations);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Failed to load reservations', error);
          Swal.fire({
            title: 'Error Loading Reservations',
            text: `Error: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
          });
          this.isLoading = false;
        }
      });
    } else {
      // For week view, get date range
      const dates = Array.from(this.selectedWeekDates).sort();
      if (dates.length > 0) {
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        this.reservationService.getUserReservationsInDateRange(startDate, endDate).subscribe({
          next: (reservations) => {
            this.updateDeskReservations(reservations);
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Failed to load reservations', error);
            Swal.fire({
              title: 'Error Loading Reservations',
              text: `Error: ${error.message}`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
            this.isLoading = false;
          }
        });
      } else {
        this.isLoading = false;
      }
    }
  }

  private updateDeskReservations(reservations: Reservation[]): void {
    if (!this.currentPlan) return;
    
    // Reset all desk statuses first
    this.currentPlan.desks.forEach(desk => {
      desk.available = true;
      desk.employeeName = undefined;
      desk.duration = undefined;
      desk.bookingDate = undefined;
    });
    
    // Update desk statuses based on reservations
    reservations.forEach(reservation => {
      const desk = this.currentPlan?.desks.find(d => d.id === reservation.deskId);
      if (desk) {
        desk.available = false;
        desk.employeeName = reservation.employeeName;
        desk.duration = reservation.duration as '4' | '8';
        desk.bookingDate = reservation.bookingDate;
        
        // If this is the user's own reservation, mark it as such
        if (this.currentUser && reservation.userId === this.currentUser.id.toString()) {
          desk.isOwnReservation = true;
        }
      }
    });
  }

  public createPlan(): void {
    if (!this.authService.isManager()) {
      Swal.fire({
        title: 'Only Managers Can Create Plans',
        text: 'Please contact a manager to create a floor plan.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Based on business rule, only one plan can exist
    // Check if any plans already exist in the database
    this.isLoading = true;
    this.reservationService.getPlans().subscribe({
      next: (existingPlans) => {
        this.isLoading = false;
        if (existingPlans.length > 0) {
          Swal.fire({
            title: 'Plan Already Exists',
            text: 'A floor plan already exists. Please delete the existing plan before creating a new one.',
            icon: 'info',
            confirmButtonText: 'OK'
          });
          return;
        }
        
        // Create a new plan if none exists
        const newPlan: ApiPlan = {
          name: 'New Floor Plan',
          width: this.INITIAL_WIDTH,
          height: this.INITIAL_HEIGHT,
          left: 50, // Default position
          top: 50   // Default position
        };
        
        this.isLoading = true;
        // Call the API to create the plan
        this.reservationService.createPlan(newPlan).subscribe({
          next: (createdPlan: ApiPlan) => {
            this.isLoading = false;
            const plan: Plan = {
              id: createdPlan.id?.toString() || `plan-${++this.planCounter}`,
              left: createdPlan.left || 50, // Use stored position if available
              top: createdPlan.top || 50,   // Use stored position if available
              width: createdPlan.width || this.INITIAL_WIDTH,
              height: createdPlan.height || this.INITIAL_HEIGHT,
              desks: [],
              walls: []
            };
            
            this.plans = [plan];
            this.currentPlan = plan;
            this.selectedPlan = plan;
            this.clearSelections();
          },
          error: (error: any) => {
            this.isLoading = false;
            console.error('Failed to create plan', error);
            Swal.fire({
              title: 'Error Creating Plan',
              text: `Error: ${error.message}`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Failed to check existing plans', error);
        Swal.fire({
          title: 'Error Checking Plans',
          text: `Error: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  private clearSelections(): void {
    this.selectedDesk = null;
    this.selectedPlan = null;
    this.selectedWall = null;
  }

  public confirmDesign(): void {
    if (!this.currentPlan) return;
    
    // Only managers can confirm the design and save changes
    if (!this.authService.isManager()) {
      Swal.fire({
        title: 'Only Managers Can Save Changes',
        text: 'Please contact a manager to save floor plan changes.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    this.isLoading = true;
    const updatedPlan: ApiPlan = {
      id: Number(this.currentPlan.id),
      width: this.currentPlan.width,
      height: this.currentPlan.height,
      left: this.currentPlan.left, // Save plan position
      top: this.currentPlan.top,    // Save plan position
      name: "Updated Floor Plan" // Adding the required name property
    };
    
    // Get the plan ID
    const planId = Number(this.currentPlan.id);
    if (isNaN(planId)) {
      Swal.fire({
        title: 'Invalid Plan ID',
        text: 'Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      this.isLoading = false;
      return;
    }
    
    // First, update the plan dimensions
    this.reservationService.updatePlan(planId, updatedPlan).subscribe({
      next: () => {
        // After plan is updated, save all newly created desks and walls
        Promise.all([
          this.saveDesks(planId),
          this.saveWalls(planId)
        ]).then(() => {
          this.isLoading = false;
          this.isPlanConfirmed = true;
          this.clearSelections();
        }).catch(error => {
          this.isLoading = false;
          console.error('Failed to save floor plan elements', error);
          Swal.fire({
            title: 'Error Saving Floor Plan',
            text: `Error: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
          });
        });
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Failed to update plan dimensions', error);
        Swal.fire({
          title: 'Error Updating Plan Dimensions',
          text: `Error: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  // Helper method to save all desks that don't have server-side IDs yet
  private async saveDesks(planId: number): Promise<void> {
    if (!this.currentPlan) return;
    
    // Get the current desks in the UI
    const currentDesks = this.currentPlan.desks;
    
    // Get the original desks from the server
    const originalDesks = await new Promise<Desk[]>((resolve, reject) => {
      this.reservationService.getDesksByPlanId(planId).subscribe({
        next: (apiDesks) => {
          // Convert API desks to UI desk format (status might be different case)
          const uiDesks = apiDesks.map(apiDesk => ({
            ...apiDesk,
            available: apiDesk.available // Use the available property directly
          }));
          resolve(uiDesks as Desk[]);
        },
        error: (err) => reject(err)
      });
    });
    
    console.log('Original desks from database:', originalDesks);
    console.log('Current desks in UI:', currentDesks);
    
    // 1. Identify new desks (exist in current but not in original)
    const newDesks = currentDesks.filter(currentDesk => 
      !originalDesks.some(origDesk => origDesk.id === currentDesk.id)
    );
    
    // 2. Identify updated desks (exist in both, but with different properties)
    const updatedDesks = currentDesks.filter(currentDesk => 
      originalDesks.some(origDesk => 
        origDesk.id === currentDesk.id && 
        (origDesk.left !== currentDesk.left || 
         origDesk.top !== currentDesk.top || 
         origDesk.rotation !== currentDesk.rotation)
      )
    );
    
    // 3. Identify deleted desks (exist in original but not in current)
    const deletedDesks = originalDesks.filter(origDesk => 
      !currentDesks.some(currentDesk => currentDesk.id === origDesk.id)
    );
    
    console.log(`Found ${newDesks.length} new desks, ${updatedDesks.length} updated desks, and ${deletedDesks.length} deleted desks`);
    
    // Handle deleted desks first
    for (const desk of deletedDesks) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.reservationService.deleteDesk(desk.id).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
        console.log(`Deleted desk with ID ${desk.id}`);
      } catch (error) {
        console.error('Error deleting desk', desk, error);
        throw error;
      }
    }
    
    // Handle updated desks
    for (const desk of updatedDesks) {
      try {
        const apiDesk: ApiDesk = {
          id: desk.id,
          left: desk.left,
          top: desk.top,
          rotation: desk.rotation,
          planId: planId
        };
        
        await new Promise((resolve, reject) => {
          this.reservationService.updateDesk(desk.id, apiDesk).subscribe({
            next: (savedDesk) => resolve(savedDesk),
            error: (err) => reject(err)
          });
        });
        console.log(`Updated desk with ID ${desk.id}`);
      } catch (error) {
        console.error('Error updating desk', desk, error);
        throw error;
      }
    }
    
    // Handle new desks
    for (const desk of newDesks) {
      try {
        const apiDesk: ApiDesk = {
          // Send desk.id as temporary ID, backend will assign a proper one
          id: desk.id,
          left: desk.left,
          top: desk.top,
          rotation: desk.rotation,
          planId: planId
        };
        
        await new Promise((resolve, reject) => {
          this.reservationService.createDesk(planId, apiDesk).subscribe({
            next: (savedDesk) => {
              // Update the desk ID to match server-side ID
              desk.id = savedDesk.id;
              resolve(savedDesk);
            },
            error: (err) => reject(err)
          });
        });
        console.log(`Created new desk with ID ${desk.id}`);
      } catch (error) {
        console.error('Error saving new desk', desk, error);
        throw error;
      }
    }
  }

  // Helper method to save all walls that don't have server-side IDs yet
  private async saveWalls(planId: number): Promise<void> {
    if (!this.currentPlan) return;
    
    // Get the current walls in the UI
    const currentWalls = this.currentPlan.walls;
    
    // Get the original walls from the server
    const originalWalls = await new Promise<Wall[]>((resolve, reject) => {
      this.reservationService.getWallsByPlanId(planId).subscribe({
        next: (apiWalls) => {
          // Convert API walls to UI wall format
          const uiWalls = apiWalls.map(apiWall => ({
            id: apiWall.id?.toString() || apiWall.wallId || `wall-${Date.now()}`, // Ensure id is always a string
            left: apiWall.left,
            top: apiWall.top,
            width: apiWall.width,
            height: apiWall.height
          }));
          resolve(uiWalls as Wall[]);
        },
        error: (err: any) => reject(err)
      });
    });
    
    console.log('Original walls from database:', originalWalls);
    console.log('Current walls in UI:', currentWalls);
    
    // 1. Identify new walls (exist in current but not in original)
    const newWalls = currentWalls.filter(currentWall => 
      !originalWalls.some(origWall => origWall.id === currentWall.id)
    );
    
    // 2. Identify updated walls (exist in both, but with different properties)
    const updatedWalls = currentWalls.filter(currentWall => 
      originalWalls.some(origWall => 
        origWall.id === currentWall.id && 
        (origWall.left !== currentWall.left || 
         origWall.top !== currentWall.top || 
         origWall.width !== currentWall.width ||
         origWall.height !== currentWall.height)
      )
    );
    
    // 3. Identify deleted walls (exist in original but not in current)
    const deletedWalls = originalWalls.filter(origWall => 
      !currentWalls.some(currentWall => currentWall.id === origWall.id)
    );
    
    console.log(`Found ${newWalls.length} new walls, ${updatedWalls.length} updated walls, and ${deletedWalls.length} deleted walls`);
    
    // Handle deleted walls
    for (const wall of deletedWalls) {
      try {
        if (wall.id && !isNaN(Number(wall.id))) {
          await new Promise<void>((resolve, reject) => {
            this.reservationService.deleteWall(Number(wall.id)).subscribe({
              next: () => resolve(),
              error: (err: any) => reject(err)
            });
          });
          console.log(`Deleted wall with ID ${wall.id}`);
        }
      } catch (error) {
        console.error('Error deleting wall', wall, error);
        throw error;
      }
    }
    
    // Handle updated walls
    for (const wall of updatedWalls) {
      try {
        if (wall.id && !isNaN(Number(wall.id))) {
          const apiWall: ApiWall = {
            id: Number(wall.id),
            left: wall.left,
            top: wall.top,
            width: wall.width,
            height: wall.height,
            planId: planId
          };
          
          await new Promise((resolve, reject) => {
            this.reservationService.updateWall(Number(wall.id), apiWall).subscribe({
              next: (savedWall) => resolve(savedWall),
              error: (err: any) => reject(err)
            });
          });
          console.log(`Updated wall with ID ${wall.id}`);
        }
      } catch (error) {
        console.error('Error updating wall', wall, error);
        throw error;
      }
    }
    
    // Handle new walls
    for (const wall of newWalls) {
      try {
        const apiWall: ApiWall = {
          wallId: wall.id,
          left: wall.left,
          top: wall.top,
          width: wall.width,
          height: wall.height,
          planId: planId
        };
        
        await new Promise((resolve, reject) => {
          this.reservationService.createWall(planId, apiWall).subscribe({
            next: (savedWall) => {
              // Update the wall ID to match server-side ID
              wall.id = savedWall.id?.toString() || wall.id;
              resolve(savedWall);
            },
            error: (err: any) => reject(err)
          });
        });
        console.log(`Created new wall with ID ${wall.id}`);
      } catch (error) {
        console.error('Error saving new wall', wall, error);
        throw error;
      }
    }
  }

  public modifyDesign(): void {
    if (!this.currentPlan) return;
      this.isPlanConfirmed = false;
    this.clearSelections();
  }

  public createDesk(plan: Plan, x: number, y: number): void {
    const newX = Math.round(Math.max(0, Math.min(x, plan.width - this.DESK_WIDTH)) / this.GRID_SIZE) * this.GRID_SIZE;
    const newY = Math.round(Math.max(0, Math.min(y, plan.height - this.DESK_HEIGHT)) / this.GRID_SIZE) * this.GRID_SIZE;
    const desk: Desk = {
      id: Date.now(),
      left: newX,
      top: newY,
      rotation: 0,
      available: true
    };
    plan.desks.push(desk);
  }

  public selectPlan(plan: Plan, event: MouseEvent): void {
    if (this.isPlanConfirmed) return;
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    // Only select plan if not clicking on a wall or desk
    if (!target.closest('.wall') && !target.closest('.desk')) {
      this.clearSelections();
      this.activePlan = plan;
      this.selectedPlan = plan;
    }
  }

  public deletePlan(): void {
    if (!this.currentPlan || !this.authService.isManager()) {
      Swal.fire({
        title: 'Only Managers Can Delete Plans',
        text: 'Please contact a manager to delete this floor plan.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Ask for confirmation with SweetAlert
    Swal.fire({
      title: 'Delete Floor Plan?',
      text: 'This will permanently delete the floor plan and all associated desks and walls. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Get the plan ID
        const planId = Number(this.currentPlan!.id);
        if (isNaN(planId)) {
          Swal.fire({
            title: 'Invalid Plan ID',
            text: 'Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
          return;
        }
        
        this.isLoading = true;
        // Call the service to delete the plan
        this.reservationService.deletePlan(planId).subscribe({
          next: () => {
            // Remove plan from UI
            if (this.currentPlan) {
              const index = this.plans.findIndex(p => p.id === this.currentPlan!.id);
              if (index !== -1) {
                this.plans.splice(index, 1);
              }
              
              // Update current and selected plan
              if (this.plans.length > 0) {
                this.currentPlan = this.plans[0];
                this.selectedPlan = this.currentPlan;
              } else {
                this.currentPlan = null;
                this.selectedPlan = null;
              }
            }
            this.isLoading = false;
            Swal.fire({
              title: 'Plan Deleted Successfully',
              text: 'The floor plan has been deleted.',
              icon: 'success',
              confirmButtonText: 'OK'
            });
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Failed to delete plan', error);
            Swal.fire({
              title: 'Error Deleting Plan',
              text: `Error: ${error.message}`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  public selectDesk(desk: Desk, event: MouseEvent): void {
    if (this.isPlanConfirmed) {
      // Always allow users to try to reserve any desk
      // The backend will handle availability checking
      this.selectedDeskForBooking = desk;
      this.showBookingDialog = true;
      this.selectedBookingDates.clear();
      // Add current date to selected dates by default
      if (this.currentDate) {
        this.selectedBookingDates.add(this.currentDate);
      }
      this.updateBookingWeekDates();
      this.bookingDuration = '4'; // Default to half day
      console.log('Opening booking dialog for desk:', desk.id, 'Current status:', desk.available ? 'Available' : 'Reserved');
    } else {
      event.stopPropagation();
      this.clearSelections();
      this.selectedDesk = desk;
    }
  }

  public rotateDesk(desk: Desk): void {
    if (this.isPlanConfirmed) return;
    desk.rotation = (desk.rotation + 90) % 360;
  }

  public removeDesk(desk: Desk, event: MouseEvent): void {
    if (this.isPlanConfirmed) return;
    
    // Stop propagation to prevent plan selection
    event.stopPropagation();
    
    // Check if manager - only managers can modify plans
    if (!this.authService.isManager()) {
      Swal.fire({
        title: 'Only Managers Can Remove Desks',
        text: 'Please contact a manager to remove this desk.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Ask for confirmation with SweetAlert
    Swal.fire({
      title: 'Remove Desk?',
      text: 'This desk will be removed from the floor plan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove from UI only - actual database removal happens on confirmDesign
        if (this.currentPlan) {
          const index = this.currentPlan.desks.findIndex(d => d.id === desk.id);
          if (index !== -1) {
            this.currentPlan.desks.splice(index, 1);
            this.clearSelections();
            console.log(`Desk removed from UI (ID: ${desk.id}). Will be removed from database on Confirm Design.`);
          }
        }
      }
    });
  }

  public createWall(): void {
    if (!this.currentPlan) return;
    const x = Math.round(10 / this.GRID_SIZE) * this.GRID_SIZE;
    const y = Math.round(35 / this.GRID_SIZE) * this.GRID_SIZE;
    const wall: Wall = {
      id: `wall-${Date.now()}`,
      left: x,
      top: y,
      width: this.WALL_SIZE,
      height: this.WALL_SIZE
    };
    this.currentPlan.walls.push(wall);
    
    // Set the wall element after it's created
    setTimeout(() => {
      const wallElement = document.querySelector(`.wall[style*="left: ${x}px"][style*="top: ${y}px"]`) as HTMLElement;
      if (wallElement) {
        wall.element = wallElement;
      }
    });
  }

  public selectWall(wall: Wall, event: MouseEvent): void {
      if (this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    this.clearSelections();
    this.selectedWall = wall;
  }

  private setupKeyboardListeners(): void {
    fromEvent(document, 'keydown').subscribe((event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(keyboardEvent.key)) {
        keyboardEvent.preventDefault();
        
        if (!this.activePlan && this.plans.length > 0) {
          this.activePlan = this.plans[0];
        }

        if (this.activePlan && !this.keyState[keyboardEvent.key]) {
          this.keyState[keyboardEvent.key] = true;
          this.movePlanWithKeyboard();
          if (!this.moveInterval) {
            this.moveInterval = setInterval(() => {
              this.movePlanWithKeyboard();
            }, 30);
          }
        }
      }
    });

    fromEvent(document, 'keyup').subscribe((event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(keyboardEvent.key)) {
        this.keyState[keyboardEvent.key] = false;
        if (Object.values(this.keyState).every(state => !state)) {
          if (this.moveInterval) {
          clearInterval(this.moveInterval);
          this.moveInterval = null;
          }
        }
      }
    });
  }

  private movePlanWithKeyboard(): void {
    if (!this.activePlan) return;
    const container = this.designContainer.nativeElement;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    let newLeft = this.activePlan.left;
    let newTop = this.activePlan.top;

    if (this.keyState['ArrowUp']) {
      newTop = Math.max(0, newTop - this.KEYBOARD_MOVE_SPEED);
    }
    if (this.keyState['ArrowDown']) {
      newTop = Math.min(containerHeight - this.activePlan.height, newTop + this.KEYBOARD_MOVE_SPEED);
    }
    if (this.keyState['ArrowLeft']) {
      newLeft = Math.max(0, newLeft - this.KEYBOARD_MOVE_SPEED);
    }
    if (this.keyState['ArrowRight']) {
      newLeft = Math.min(containerWidth - this.activePlan.width, newLeft + this.KEYBOARD_MOVE_SPEED);
    }

    this.activePlan.left = Math.round(newLeft / this.GRID_SIZE) * this.GRID_SIZE;
    this.activePlan.top = Math.round(newTop / this.GRID_SIZE) * this.GRID_SIZE;
  }

  @HostListener('click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.desk') && !target.closest('.wall') && !target.closest('.plan') && 
        !target.closest('.desk-booking-info')) {
      this.selectedDesk = null;
      this.selectedPlan = null;
      this.selectedWall = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const container = this.designContainer.nativeElement as HTMLElement;
    const statusBar = document.querySelector('.status-bar') as HTMLElement;
    container.style.width = 'calc(100% - 340px - 3rem)';
    if (statusBar) statusBar.style.width = 'calc(100% - 340px - 3rem)';
  }

  public onPlanContextMenu(event: MouseEvent, plan: Plan): void {
    event.preventDefault();
    this.selectPlan(plan, event);
  }

  public startPlanDragging(event: MouseEvent, plan: Plan): void {
    if (this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    this.activePlan = plan;
    this.selectedPlan = plan;

    this.isDragging = true;
    this.startX = event.clientX - plan.left;
    this.startY = event.clientY - plan.top;

    const container = this.designContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();

    const moveSubscription = fromEvent(document, 'mousemove').subscribe((e: Event) => {
      if (!this.isDragging || !this.selectedPlan) return;
      const mouseEvent = e as MouseEvent;
      
      let newLeft = mouseEvent.clientX - this.startX;
      let newTop = mouseEvent.clientY - this.startY;

      newLeft = Math.round(newLeft / this.GRID_SIZE) * this.GRID_SIZE;
      newTop = Math.round(newTop / this.GRID_SIZE) * this.GRID_SIZE;

      newLeft = Math.max(0, Math.min(newLeft, containerRect.width - this.selectedPlan.width));
      newTop = Math.max(0, Math.min(newTop, containerRect.height - this.selectedPlan.height));

      this.selectedPlan.left = newLeft;
      this.selectedPlan.top = newTop;
    });

    const upSubscription = fromEvent(document, 'mouseup').subscribe(() => {
      this.isDragging = false;
      moveSubscription.unsubscribe();
      upSubscription.unsubscribe();
    });
  }

  public startPlanResizing(event: MouseEvent, plan: Plan, handle: string): void {
    if (this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    this.activePlan = plan;
    this.selectedPlan = plan;

    this.isResizing = true;
    this.resizeHandle = handle;
    this.startX = event.clientX;
    this.startY = event.clientY;

    const container = this.designContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();
    const initialWidth = plan.width;
    const initialHeight = plan.height;
    const initialLeft = plan.left;
    const initialTop = plan.top;

    // Find the rightmost and bottommost desk positions
    let maxDeskRight = 0;
    let maxDeskBottom = 0;
    plan.desks.forEach(desk => {
      maxDeskRight = Math.max(maxDeskRight, desk.left + this.DESK_WIDTH);
      maxDeskBottom = Math.max(maxDeskBottom, desk.top + this.DESK_HEIGHT);
    });

    // Add padding to ensure desks remain visible
    const minRequiredWidth = maxDeskRight + 10;
    const minRequiredHeight = maxDeskBottom + 10;

    const moveSubscription = fromEvent(document, 'mousemove').subscribe((e: Event) => {
      if (!this.isResizing || !this.selectedPlan) return;
      const mouseEvent = e as MouseEvent;
      let deltaX = mouseEvent.clientX - this.startX;
      let deltaY = mouseEvent.clientY - this.startY;

      deltaX = Math.round(deltaX / this.GRID_SIZE) * this.GRID_SIZE;
      deltaY = Math.round(deltaY / this.GRID_SIZE) * this.GRID_SIZE;

      let newWidth = initialWidth;
      let newHeight = initialHeight;
      let newLeft = initialLeft;
      let newTop = initialTop;

      // Calculate new dimensions based on handle
      switch (handle) {
        case 'right':
          newWidth = Math.max(Math.max(this.MIN_PLAN_WIDTH, minRequiredWidth), Math.min(initialWidth + deltaX, containerRect.width - this.selectedPlan.left));
          break;
        case 'bottom':
          newHeight = Math.max(Math.max(this.MIN_PLAN_HEIGHT, minRequiredHeight), Math.min(initialHeight + deltaY, containerRect.height - this.selectedPlan.top));
          break;
        case 'bottom-right':
          newWidth = Math.max(Math.max(this.MIN_PLAN_WIDTH, minRequiredWidth), Math.min(initialWidth + deltaX, containerRect.width - this.selectedPlan.left));
          newHeight = Math.max(Math.max(this.MIN_PLAN_HEIGHT, minRequiredHeight), Math.min(initialHeight + deltaY, containerRect.height - this.selectedPlan.top));
          break;
        case 'left':
          const newWidthL = Math.max(this.MIN_PLAN_SIZE, Math.min(initialWidth - deltaX, initialLeft + initialWidth));
          newLeft = initialLeft + (initialWidth - newWidthL);
          newWidth = newWidthL;
          break;
        case 'top':
          const newHeightT = Math.max(this.MIN_PLAN_SIZE, Math.min(initialHeight - deltaY, initialTop + initialHeight));
          newTop = initialTop + (initialHeight - newHeightT);
          newHeight = newHeightT;
          break;
        case 'top-left':
          const newWidthTL = Math.max(this.MIN_PLAN_SIZE, Math.min(initialWidth - deltaX, initialLeft + initialWidth));
          const newHeightTL = Math.max(this.MIN_PLAN_SIZE, Math.min(initialHeight - deltaY, initialTop + initialHeight));
          newLeft = initialLeft + (initialWidth - newWidthTL);
          newTop = initialTop + (initialHeight - newHeightTL);
          newWidth = newWidthTL;
          newHeight = newHeightTL;
          break;
        case 'top-right':
          const newHeightTR = Math.max(this.MIN_PLAN_SIZE, Math.min(initialHeight - deltaY, initialTop + initialHeight));
          newTop = initialTop + (initialHeight - newHeightTR);
          newWidth = Math.max(this.MIN_PLAN_SIZE, Math.min(initialWidth + deltaX, containerRect.width - this.selectedPlan.left));
          newHeight = newHeightTR;
          break;
        case 'bottom-left':
          const newWidthBL = Math.max(this.MIN_PLAN_SIZE, Math.min(initialWidth - deltaX, initialLeft + initialWidth));
          newHeight = Math.max(this.MIN_PLAN_SIZE, Math.min(initialHeight + deltaY, containerRect.height - this.selectedPlan.top));
          newLeft = initialLeft + (initialWidth - newWidthBL);
          newWidth = newWidthBL;
          break;
        case 'left':
          newWidth = Math.max(this.MIN_PLAN_SIZE, Math.min(initialWidth - deltaX, initialLeft + initialWidth));
          newLeft = initialLeft + (initialWidth - newWidth);
          break;
      }
      
      // Update plan dimensions
      this.selectedPlan.width = newWidth;
      this.selectedPlan.height = newHeight;
      this.selectedPlan.left = newLeft;
      this.selectedPlan.top = newTop;

      // Adjust desk positions to stay within the new plan boundaries
      this.selectedPlan.desks.forEach(desk => {
        // Calculate new desk position
        let newDeskLeft = desk.left;
        let newDeskTop = desk.top;

        // If desk would be outside the new plan boundaries, move it inside
        if (newDeskLeft + this.DESK_WIDTH > newWidth) {
          newDeskLeft = Math.max(0, newWidth - this.DESK_WIDTH);
        }
        if (newDeskTop + this.DESK_HEIGHT > newHeight) {
          newDeskTop = Math.max(0, newHeight - this.DESK_HEIGHT);
        }

        // Update desk position
        desk.left = newDeskLeft;
        desk.top = newDeskTop;
      });

      // Adjust wall positions to stay within the new plan boundaries
      this.selectedPlan.walls.forEach(wall => {
        wall.left = Math.min(wall.left, newWidth - wall.width);
        wall.top = Math.min(wall.top, newHeight - wall.height);
        if (wall.left < 0) wall.left = 0;
        if (wall.top < 0) wall.top = 0;
      });
    });

    const upSubscription = fromEvent(document, 'mouseup').subscribe(() => {
      this.isResizing = false;
      this.resizeHandle = '';
      moveSubscription.unsubscribe();
      upSubscription.unsubscribe();
    });
  }

  public startDeskDragging(event: MouseEvent, desk: Desk): void {
    if (!this.currentPlan || this.isPlanConfirmed) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Select the desk when starting to drag
    this.selectDesk(desk, event);
    
    const plan = this.currentPlan;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = desk.left;
    const startTop = desk.top;
    
    const onMouseMove = (e: MouseEvent) => {
      if (!desk) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Calculate new position with grid snapping
      const newLeft = Math.round((startLeft + dx) / this.GRID_SIZE) * this.GRID_SIZE;
      const newTop = Math.round((startTop + dy) / this.GRID_SIZE) * this.GRID_SIZE;
      
      // Constrain to plan boundaries with proper desk dimensions
      desk.left = Math.max(0, Math.min(newLeft, plan.width - this.DESK_WIDTH));
      desk.top = Math.max(0, Math.min(newTop, plan.height - this.DESK_HEIGHT));
      
      // Update desk position
      desk.moving = true;
      this.showSnapGuides(desk, plan);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (desk) {
        desk.moving = false;
      }
      this.hideSnapGuides();
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  public onDeskContextMenu(event: MouseEvent, desk: Desk): void {
    if (this.isPlanConfirmed) {
      // In booking mode, context menu opens booking dialog
      this.selectedDeskForBooking = desk;
      this.showBookingDialog = true;
      this.updateBookingWeekDates();
      
      // If desk is already reserved, show details for cancellation
      if (desk.available === false && desk.employeeName) {
        this.employeeName = desk.employeeName;
      } else {
        // For new reservations, we don't need to set employeeName as the server will handle it
        this.employeeName = '';
      }
    } else {
      // In design mode, context menu is for removing desks
      if (confirm('Do you want to remove this desk?')) {
        // Remove the desk from the current plan
        if (this.currentPlan) {
          this.currentPlan.desks = this.currentPlan.desks.filter(d => d !== desk);
          
          // Clear selection if the removed desk was selected
          if (this.selectedDesk === desk) {
            this.selectedDesk = null;
          }
        }
      }
    }
  }

  public startWallDragging(event: MouseEvent, wall: Wall): void {
    if (!this.currentPlan || this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    this.selectedWall = wall;
    this.isDragging = true;
    this.startX = event.clientX - wall.left;
    this.startY = event.clientY - wall.top;

    const plan = this.currentPlan;
    if (!plan) return;

    // Add moving class for visual feedback
    wall.moving = true;

    const moveSubscription = fromEvent<MouseEvent>(document, 'mousemove')
      .pipe(takeUntil(fromEvent(document, 'mouseup')))
      .subscribe((moveEvent: MouseEvent) => {
        if (!this.isDragging || !this.selectedWall) return;
        
        let newLeft = moveEvent.clientX - this.startX;
        let newTop = moveEvent.clientY - this.startY;

        // Enhanced grid snapping with smaller grid size
        const gridSize = this.GRID_SIZE / 2;
        newLeft = Math.round(newLeft / gridSize) * gridSize;
        newTop = Math.round(newTop / gridSize) * gridSize;

        // Allow walls to touch the plan boundaries
        newLeft = Math.max(0, Math.min(newLeft, plan.width - wall.width));
        newTop = Math.max(0, Math.min(newTop, plan.height - wall.height));

        // Smooth movement with requestAnimationFrame
        requestAnimationFrame(() => {
          wall.left = newLeft;
          wall.top = newTop;
        });

        // Show snap guides
        this.showSnapGuides(wall, plan);
      });

    const upSubscription = fromEvent(document, 'mouseup')
      .pipe(take(1))
      .subscribe(() => {
        this.isDragging = false;
        wall.moving = false;
        this.hideSnapGuides();
        moveSubscription.unsubscribe();
        upSubscription.unsubscribe();
      });
  }

  public startWallResizing(event: MouseEvent, wall: Wall, handle: string): void {
    if (!this.currentPlan || this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    wall.resizing = true;
    this.resizeHandle = handle;
    
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = wall.width;
    const startHeight = wall.height;
    const startLeft = wall.left;
    const startTop = wall.top;
    
    const plan = this.currentPlan;
    if (!plan) return;
    
    const moveSubscription = fromEvent<MouseEvent>(document, 'mousemove')
      .pipe(takeUntil(fromEvent(document, 'mouseup')))
      .subscribe((moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        
        // Enhanced grid snapping with smaller grid size
        const gridSize = this.GRID_SIZE / 2;
        const snappedDeltaX = Math.round(deltaX / gridSize) * gridSize;
        const snappedDeltaY = Math.round(deltaY / gridSize) * gridSize;
        
        const minSize = this.GRID_SIZE;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        // Handle resizing based on the handle position
        switch (handle) {
          case 'top-left':
            newWidth = Math.max(minSize, Math.min(startWidth - snappedDeltaX, startLeft + startWidth));
            newHeight = Math.max(minSize, Math.min(startHeight - snappedDeltaY, startTop + startHeight));
            newLeft = startLeft + (startWidth - newWidth);
            newTop = startTop + (startHeight - newHeight);
            break;
          case 'top':
            newHeight = Math.max(minSize, Math.min(startHeight - snappedDeltaY, startTop + startHeight));
            newTop = startTop + (startHeight - newHeight);
            break;
          case 'top-right':
            newWidth = Math.max(minSize, Math.min(startWidth + snappedDeltaX, plan.width - startLeft));
            newHeight = Math.max(minSize, Math.min(startHeight - snappedDeltaY, startTop + startHeight));
            newTop = startTop + (startHeight - newHeight);
            break;
          case 'right':
            newWidth = Math.max(minSize, Math.min(startWidth + snappedDeltaX, plan.width - startLeft));
            break;
          case 'bottom-right':
            newWidth = Math.max(minSize, Math.min(startWidth + snappedDeltaX, plan.width - startLeft));
            newHeight = Math.max(minSize, Math.min(startHeight + snappedDeltaY, plan.height - startTop));
            break;
          case 'bottom':
            newHeight = Math.max(minSize, Math.min(startHeight + snappedDeltaY, plan.height - startTop));
            break;
          case 'bottom-left':
            newWidth = Math.max(minSize, Math.min(startWidth - snappedDeltaX, startLeft + startWidth));
            newHeight = Math.max(minSize, Math.min(startHeight + snappedDeltaY, plan.height - startTop));
            newLeft = startLeft + (startWidth - newWidth);
            break;
          case 'left':
            newWidth = Math.max(minSize, Math.min(startWidth - snappedDeltaX, startLeft + startWidth));
            newLeft = startLeft + (startWidth - newWidth);
            break;
        }
        
        // Smooth update with requestAnimationFrame
        requestAnimationFrame(() => {
          wall.width = newWidth;
          wall.height = newHeight;
          wall.left = newLeft;
          wall.top = newTop;
        });
      });
    
    const upSubscription = fromEvent(document, 'mouseup')
      .pipe(take(1))
      .subscribe(() => {
        this.resizeHandle = '';
        wall.resizing = false;
        moveSubscription.unsubscribe();
        upSubscription.unsubscribe();
      });
  }

  private showSnapGuides(element: Desk | Wall, plan: Plan): void {
    // Remove existing guides
    this.hideSnapGuides();
    
    // Create vertical guide
    const verticalGuide = document.createElement('div');
    verticalGuide.className = 'snap-guide vertical';
    verticalGuide.style.left = element.left + 'px';
    verticalGuide.style.top = '0';
    verticalGuide.style.height = plan.height + 'px';
    this.designContainer.nativeElement.appendChild(verticalGuide);
    
    // Create horizontal guide
    const horizontalGuide = document.createElement('div');
    horizontalGuide.className = 'snap-guide horizontal';
    horizontalGuide.style.left = '0';
    horizontalGuide.style.top = element.top + 'px';
    horizontalGuide.style.width = plan.width + 'px';
    this.designContainer.nativeElement.appendChild(horizontalGuide);
  }

  private hideSnapGuides(): void {
    const container = this.designContainer.nativeElement;
    const guides = container.querySelectorAll('.snap-guide');
    guides.forEach(guide => guide.remove());
  }

  private setupDocumentClickHandler(): void {
    fromEvent(document, 'click').subscribe((event: Event) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a wall, plan, desk, or resize handle
      const clickedOnWall = target.closest('.wall');
      const clickedOnPlan = target.closest('.plan');
      const clickedOnDesk = target.closest('.desk');
      const clickedOnResizeHandle = target.closest('.wall-resize-handle') || 
                                   target.closest('.plan-resize-handle') || 
                                   target.closest('.desk-resize-handle');
      
      // If click is not on any interactive element, clear all selections
      if (!clickedOnWall && !clickedOnPlan && !clickedOnDesk && !clickedOnResizeHandle) {
        this.selectedWall = null;
        this.selectedPlan = null;
        this.selectedDesk = null;
      }
    });
  }

  public createDeskAtPosition(event: MouseEvent, plan: Plan): void {
    if (this.isPlanConfirmed) return;
    event.preventDefault(); // Prevent the default context menu
    event.stopPropagation();

    // Get the click position relative to the plan
    const planElement = event.currentTarget as HTMLElement;
    const planRect = planElement.getBoundingClientRect();
    
    // Calculate position relative to the plan
    const x = event.clientX - planRect.left;
    const y = event.clientY - planRect.top;

    // Create the desk at the clicked position
    this.createDesk(plan, x, y);
  }

  public onWallContextMenu(event: MouseEvent, wall: Wall): void {
    if (this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    // Check if manager - only managers can modify plans
    if (!this.authService.isManager()) {
      Swal.fire({
        title: 'Only Managers Can Modify Walls',
        text: 'Please contact a manager to modify walls.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Show context menu with delete option
    Swal.fire({
      title: 'Wall Options',
      text: 'Would you like to remove this wall?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Remove Wall',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove wall
        if (this.currentPlan) {
          const index = this.currentPlan.walls.findIndex(w => w.id === wall.id);
          if (index !== -1) {
            this.currentPlan.walls.splice(index, 1);
            this.clearSelections();
            console.log(`Wall removed from UI (ID: ${wall.id}). Will be removed from database on Confirm Design.`);
          }
        }
      }
    });
  }

  public confirmBooking(): void {
    if (!this.selectedDeskForBooking) return;
    
    this.isLoading = true;
    
    // Get all the selected dates
    const dates = Array.from(this.selectedBookingDates);
    if (dates.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please select at least one date for the reservation',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      this.isLoading = false;
      return;
    }
    
    // Track completion status for each date
    let completedBookings = 0;
    let failedBookings = 0;
    
    // Create bookings for all selected dates
    this.selectedBookingDates.forEach(date => {
      // Create reservation object to send to backend
      // The backend will automatically use the current user's information
      const reservation: Reservation = {
        deskId: this.selectedDeskForBooking!.id,
        bookingDate: date,
        duration: this.bookingDuration
      };
      
      this.reservationService.createReservation(reservation).subscribe({
        next: (response) => {
          completedBookings++;
          console.log(`Created reservation for date ${date}`, response);
          
          // Check if all bookings are processed
          this.checkBookingCompletion(completedBookings, failedBookings);
        },
        error: (error: any) => {
          failedBookings++;
          console.error(`Failed to create reservation for date ${date}`, error);
          
          // Check for specific error conditions
          if (error.status === 409 || 
              (error.error && error.error.message && error.error.message.includes('one desk reservation is allowed per day'))) {
            Swal.fire({
              title: 'Reservation Failed',
              text: `Could not book desk for ${this.formatDate(date)}: You already have a desk reservation for this date.`,
              icon: 'warning',
              confirmButtonText: 'OK'
            });
          } else if (error.status === 400 && error.error && error.error.message && error.error.message.includes('reserved')) {
            Swal.fire({
              title: 'Reservation Failed',
              text: `Could not book desk for ${this.formatDate(date)}: Desk already reserved by another user.`,
              icon: 'warning',
              confirmButtonText: 'OK'
            });
          } else {
            // Generic error handling
            Swal.fire({
              title: 'Reservation Failed',
              text: `Could not book desk for ${this.formatDate(date)}: ${error.message || 'Unknown error'}`,
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
          
          // Check if all bookings are processed
          this.checkBookingCompletion(completedBookings, failedBookings);
        }
      });
    });
  }
  
  private checkBookingCompletion(completed: number, failed: number): void {
    const total = this.selectedBookingDates.size;
    
    // Only proceed if all dates have been processed
    if (completed + failed === total) {
      this.isLoading = false;
      
      if (completed === total) {
        // All bookings succeeded
        Swal.fire({
          title: 'Success',
          text: 'Your reservations have been confirmed!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        this.closeBookingDialog();
        this.loadReservationsForCurrentView();
      } else if (completed > 0) {
        // Some bookings succeeded
        Swal.fire({
          title: 'Partial Success',
          text: `${completed} out of ${total} reservations were confirmed. Please check the errors for details.`,
          icon: 'info',
          confirmButtonText: 'OK'
        });
        this.closeBookingDialog();
        this.loadReservationsForCurrentView();
      }
      // Note: We don't show a generic "all failed" message here anymore
      // since specific error messages are already shown for each date
    }
  }

  public cancelBooking(): void {
    if (!this.selectedDeskForBooking || !this.selectedDeskForBooking.bookingDate) {
      return;
    }

    this.isLoading = true;

    // Find the reservation ID for this desk and date
    this.reservationService.getUserReservations().subscribe({
      next: (reservations) => {
        const reservation = reservations.find(r => 
          r.deskId === this.selectedDeskForBooking?.id && 
          r.bookingDate === this.selectedDeskForBooking?.bookingDate);
        
        if (reservation && reservation.id) {
          // Delete the reservation
          this.reservationService.deleteReservation(reservation.id).subscribe({
            next: () => {
              // Update the desk status in UI
              if (this.currentPlan && this.selectedDeskForBooking) {
                const deskIndex = this.currentPlan.desks.findIndex(d => d.id === this.selectedDeskForBooking!.id);
                if (deskIndex !== -1) {
                  this.currentPlan.desks[deskIndex].available = true;
                  this.currentPlan.desks[deskIndex].employeeName = undefined;
                  this.currentPlan.desks[deskIndex].duration = undefined;
                  this.currentPlan.desks[deskIndex].bookingDate = undefined;
                }
              }
              
              Swal.fire({
                title: 'Reservation Cancelled Successfully',
                text: 'The reservation has been cancelled.',
                icon: 'success',
                confirmButtonText: 'OK'
              });
              this.isLoading = false;
              this.showBookingDialog = false;
              this.selectedDeskForBooking = null;
              this.bookingDuration = '4';
              
              // Refresh reservations
              this.loadReservationsForCurrentView();
            },
            error: (error: any) => {
              console.error('Failed to cancel reservation', error);
              Swal.fire({
                title: 'Error Cancelling Reservation',
                text: `Error: ${error.message}`,
                icon: 'error',
                confirmButtonText: 'OK'
              });
              this.isLoading = false;
            }
          });
        } else {
          console.error('Could not find matching reservation to cancel');
          Swal.fire({
            title: 'Error Cancelling Reservation',
            text: 'Could not find the reservation to cancel.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Failed to get user reservations', error);
        Swal.fire({
          title: 'Error Getting Reservations',
          text: `Error: ${error.message}`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        this.isLoading = false;
      }
    });
  }

  public closeBookingDialog(): void {
    this.showBookingDialog = false;
    this.selectedDeskForBooking = null;
    this.bookingDuration = '4';
    this.selectedBookingDates.clear();
  }

  public formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = dateObj.getDate();
    
    // Only show month in day view mode
    if (this.viewMode === 'day') {
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
      return `${dayName} ${dayNumber} ${monthName}`;
    }
    
    // In week view, only show day name and number
    return `${dayName} ${dayNumber}`;
  }

  public isToday(date: string): boolean {
    const today = new Date();
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toDateString() === today.toDateString();
  }

  public isPastDate(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj < today;
  }

  public toggleBookingDate(date: string): void {
    if (this.isPastDate(date)) return;
    
    if (this.selectedBookingDates.has(date)) {
      this.selectedBookingDates.delete(date);
    } else {
      this.selectedBookingDates.add(date);
    }
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }

  private getNextBusinessDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    while (this.isWeekend(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  }

  private getPreviousBusinessDay(date: Date): Date {
    const prevDay = new Date(date);
    prevDay.setDate(date.getDate() - 1);
    while (this.isWeekend(prevDay)) {
      prevDay.setDate(prevDay.getDate() - 1);
    }
    return prevDay;
  }

  public canGoToPreviousDate(): boolean {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDateObj = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the previous business day
    const prevBusinessDay = this.getPreviousBusinessDay(currentDateObj);
    return prevBusinessDay >= today;
  }

  public canGoToNextDate(): boolean {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDateObj = new Date(year, month - 1, day);
    const maxDate = new Date();
    maxDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + this.MAX_FUTURE_DAYS);
    
    // Get the next business day
    const nextBusinessDay = this.getNextBusinessDay(currentDateObj);
    return nextBusinessDay <= maxDate;
  }

  public previousDate(): void {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDateObj = new Date(year, month - 1, day);
    
    // Get the previous business day
    const newDate = this.getPreviousBusinessDay(currentDateObj);
    
    // Only allow navigation if the new date is not before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDate >= today) {
      const newYear = newDate.getFullYear();
      const newMonth = String(newDate.getMonth() + 1).padStart(2, '0');
      const newDay = String(newDate.getDate()).padStart(2, '0');
      this.currentDate = `${newYear}-${newMonth}-${newDay}`;
      
      // Update week dates if in week view
      if (this.viewMode === 'week') {
        this.updateWeekDates();
      }
      
      // Always update desk statuses
      this.updateDeskStatuses();
    }
  }

  public nextDate(): void {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDateObj = new Date(year, month - 1, day);
    
    // Get the next business day
    const newDate = this.getNextBusinessDay(currentDateObj);
    
    // Check if the new date is within the two-week limit
    const maxDate = new Date();
    maxDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + this.MAX_FUTURE_DAYS);
    
    if (newDate <= maxDate) {
      const newYear = newDate.getFullYear();
      const newMonth = String(newDate.getMonth() + 1).padStart(2, '0');
      const newDay = String(newDate.getDate()).padStart(2, '0');
      this.currentDate = `${newYear}-${newMonth}-${newDay}`;
      
      // Update week dates if in week view
      if (this.viewMode === 'week') {
        this.updateWeekDates();
      }
      
      // Always update desk statuses
      this.updateDeskStatuses();
    }
  }

  private updateDeskStatuses(): void {
    if (!this.currentPlan) return;
    console.log('Updating desk statuses, user:', this.currentUser?.role);
    
    // Reset all desk statuses first
    this.currentPlan.desks.forEach(desk => {
      desk.available = true;
      desk.employeeName = undefined;
      desk.duration = undefined;
      desk.bookingDate = undefined;
      desk.isOwnReservation = false;
    });

    // Clear previous reservation data
    this.reservationsByDate.clear();

    // Get all reservations for the currently displayed dates
    const dates = this.viewMode === 'week' ? this.weekDates : [this.currentDate];
    console.log('Fetching reservations for dates:', dates);
    
    // Keep track of requests to know when all are complete
    let pendingRequests = dates.length;
    
    // For each date, load and display the reservations
    dates.forEach(date => {
      console.log(`Loading reservations for date: ${date}`);
      this.reservationService.getReservationsByDate(date).subscribe({
        next: (reservations) => {
          console.log(`Got ${reservations.length} reservations for date ${date}`);
          
          // Store reservation data for this date
          this.reservationsByDate.set(date, reservations);
          
          // Process each reservation
          reservations.forEach(reservation => {
            const desk = this.currentPlan?.desks.find(d => d.id === reservation.deskId);
            if (desk) {
              console.log(`Desk ${desk.id} is reserved on ${date}`);
              
              // For current date view, or if this is the specific date in week view
              if (date === this.currentDate) {
                desk.available = false;
                desk.employeeName = reservation.employeeName;
                desk.duration = reservation.duration as '4' | '8';
                desk.bookingDate = reservation.bookingDate;
                
                // If this is the user's own reservation, mark it as such
                if (this.currentUser && reservation.userId === this.currentUser.id.toString()) {
                  desk.isOwnReservation = true;
                }
              }
            }
          });
          
          // Decrement pending requests count
          pendingRequests--;
          
          // If all requests are complete, update the UI
          if (pendingRequests === 0) {
            console.log('All reservation data loaded');
          }
        },
        error: (error: any) => {
          console.error(`Failed to load reservations for ${date}`, error);
          pendingRequests--;
        }
      });
    });
  }

  private updateWeekDates(): void {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    this.weekDates = [];
    
    // Get Monday of the current week
    const monday = new Date(currentDate);
    const dayOfWeek = currentDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
    monday.setDate(currentDate.getDate() + diff);
    
    // Today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get business days for the current week and next week
    for (let week = 0; week < 2; week++) {
      for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i + (week * 7)); // Add week offset for second week
        
        // Only include dates that are today or in the future
        if (date >= today && !this.isWeekend(date)) {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          this.weekDates.push(dateStr);
        }
      }
    }
  }

  public toggleViewMode(): void {
    this.viewMode = this.viewMode === 'day' ? 'week' : 'day';
    if (this.viewMode === 'week') {
      this.updateWeekDates();
      // Set the selected week date to the current date if it's in the week
      if (this.weekDates.includes(this.currentDate)) {
        this.selectedWeekDates.clear();
        this.selectedWeekDates.add(this.currentDate);
      } else {
        // If current date is not in the week, select the first day of the week
        this.selectedWeekDates.clear();
        this.selectedWeekDates.add(this.weekDates[0]);
        this.currentDate = this.weekDates[0];
        this.updateDeskStatuses();
      }
    }
  }

  public toggleWeekDate(date: string, event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection with Ctrl/Cmd key
      if (this.selectedWeekDates.has(date)) {
        this.selectedWeekDates.delete(date);
      } else {
        this.selectedWeekDates.add(date);
      }
    } else {
      // Single selection without Ctrl/Cmd
      this.selectedWeekDates.clear();
      this.selectedWeekDates.add(date);
    }
    this.currentDate = date;
    this.updateDeskStatuses();
  }

  // Helper method to check if a desk is available on a specific date
  public isDeskAvailableOnDate(desk: Desk, date: string): boolean {
    if (!this.reservationsByDate.has(date)) {
      return true; // No reservations loaded for this date yet
    }
    
    const reservations = this.reservationsByDate.get(date) || [];
    const isReserved = reservations.some(r => r.deskId === desk.id);
    return !isReserved;
  }
  
  // Get the first letter of the day name for compact display
  public getDayInitial(date: string): string {
    if (!date) return '';
    
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    return dayName.charAt(0);
  }
  
  // Get detailed status text for a desk on a specific date
  public getDeskStatusForDate(desk: Desk, date: string): string {
    if (this.isDeskAvailableOnDate(desk, date)) {
      return `Available on ${this.formatDate(date)}`;
    }
    
    const reservations = this.reservationsByDate.get(date) || [];
    const reservation = reservations.find(r => r.deskId === desk.id);
    
    if (reservation) {
      const duration = reservation.duration === '8' ? 'Full day' : 'Half day';
      return `${reservation.employeeName || ''} - ${duration} on ${this.formatDate(date)}`;
    }
    
    return `${this.formatDate(date)}`;
  }

  public isSelectedBookingDate(date: string): boolean {
    return this.selectedBookingDates.has(date);
  }

  private updateBookingWeekDates(): void {
    // Use the same date generation as updateWeekDates
    if (this.selectedDeskForBooking) {
      const [year, month, day] = this.currentDate.split('-').map(Number);
      const currentDate = new Date(year, month - 1, day);
      this.bookingWeekDates = [];
      
      // Get Monday of the current week
      const monday = new Date(currentDate);
      const dayOfWeek = currentDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
      monday.setDate(currentDate.getDate() + diff);
      
      // Skip past dates and dates too far in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + this.MAX_FUTURE_DAYS);
      
      // Generate dates for two weeks (current week and next week)
      for (let week = 0; week < 2; week++) {
        for (let i = 0; i < 5; i++) { // Monday to Friday (workdays)
          const date = new Date(monday);
          date.setDate(monday.getDate() + i + (week * 7)); // Add week offset for second week
          
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          
          if (date >= today && date <= maxDate && !this.isWeekend(date)) {
            this.bookingWeekDates.push(dateStr);
          }
        }
      }
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

  // Handle window resize events to recalculate container dimensions
  private handleResize(): void {
    this.syncContainerWidths();
    this.updateContainerWidths();
  }
  
  // Set up listener to detect when developer tools are closed
  private setupDevToolsCloseListener(): void {
    // Create ResizeObserver to monitor body element size changes
    const resizeObserver = new ResizeObserver(() => {
      // This will trigger when body size changes (including when dev tools are closed)
      this.syncContainerWidths();
      this.updateContainerWidths();
    });
    
    // Observe the document body for size changes
    resizeObserver.observe(document.body);
  }

  // Force a repaint on an element to ensure proper rendering
  private forceRepaint(element: HTMLElement): void {
    // Technique to force a repaint without changing visible styles
    element.style.display = 'none';
    void element.offsetHeight; // Trigger reflow
    element.style.display = '';
  }
}