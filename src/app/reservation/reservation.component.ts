import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { fromEvent, Subscription, takeUntil, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Desk {
  id: number;
  left: number;
  top: number;
  rotation: number;
  moving?: boolean;
  status?: 'available' | 'reserved';
  employeeName?: string;
  duration?: '4' | '8'; // 4 for half day, 8 for full day
  bookingDate?: string;
}

export interface Wall {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
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
  @ViewChild('designContainer', { static: true }) designContainer!: ElementRef<HTMLElement>;
  @ViewChild('statusBar', { static: true }) statusBar!: ElementRef<HTMLElement>;
  
  public plans: Plan[] = [];
  public currentPlan: Plan | null = null;
  public selectedPlan: Plan | null = null;
  public selectedDesk: Desk | null = null;
  public selectedWall: Wall | null = null;
  public isPlanConfirmed = false;
  public isSidebarVisible = true;
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

  ngOnInit(): void {
    this.setupKeyboardListeners();
    this.syncContainerWidths();
    this.setupDocumentClickHandler();
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
  }

  private syncContainerWidths(): void {
    const designContainer = this.designContainer.nativeElement;
    const statusBar = this.statusBar.nativeElement;
    
    this.updateContainerWidths();

    fromEvent(window, 'resize').subscribe(() => {
      this.updateContainerWidths();
    });
  }

  private updateContainerWidths(): void {
    const designContainer = this.designContainer.nativeElement;
    const statusBar = this.statusBar.nativeElement;
    
    if (this.isSidebarVisible) {
      designContainer.style.setProperty('--content-width', 'calc(100% - 340px - 3rem)');
      designContainer.style.setProperty('--sidebar-width', '340px');
      statusBar.style.setProperty('--content-width', 'calc(100% - 340px - 3rem)');
      statusBar.style.setProperty('--sidebar-width', '340px');
    } else {
      designContainer.style.setProperty('--content-width', 'calc(100% - 3rem - 3rem)');
      designContainer.style.setProperty('--sidebar-width', '0');
      statusBar.style.setProperty('--content-width', 'calc(100% - 3rem - 3rem)');
      statusBar.style.setProperty('--sidebar-width', '0');
    }
  }

  public toggleSidebar(): void {
    this.isSidebarVisible = !this.isSidebarVisible;
    this.updateContainerWidths();
  }

  public createPlan(): void {
    if (this.plans.length >= 1) return;
    this.planCounter++;
    const plan: Plan = {
      id: `plan-${this.planCounter}`,
      left: 0,
      top: 0,
      width: this.INITIAL_WIDTH,
      height: this.INITIAL_HEIGHT,
      desks: [],
      walls: []
    };
    this.plans.push(plan);
    this.currentPlan = plan;
    this.isPlanConfirmed = false;
  }

  private clearSelections(): void {
    this.selectedDesk = null;
    this.selectedPlan = null;
    this.selectedWall = null;
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
    if (this.currentPlan && confirm('Are you sure you want to delete this plan?')) {
      this.plans = this.plans.filter(p => p !== this.currentPlan);
      this.currentPlan = null;
      this.selectedPlan = null;
      this.selectedDesk = null;
      this.selectedWall = null;
      this.isPlanConfirmed = false;
      this.planCounter = 0;
    }
  }

  public confirmDesign(): void {
    if (!this.currentPlan) return;
      this.isPlanConfirmed = true;
    this.clearSelections();
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
      status: 'available'
    };
    plan.desks.push(desk);
  }

  public selectDesk(desk: Desk, event: MouseEvent): void {
    if (this.isPlanConfirmed) {
      this.selectedDeskForBooking = desk;
      this.showBookingDialog = true;
      this.selectedBookingDates.clear();
      this.selectedBookingDates.add(this.currentDate);
      this.updateBookingWeekDates();
      if (desk.status === 'reserved') {
        this.employeeName = desk.employeeName || '';
        this.bookingDuration = desk.duration || '4';
      } else {
        this.employeeName = '';
        this.bookingDuration = '4';
      }
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

  public createWall(): void {
    if (!this.currentPlan) return;
    const x = Math.round(10 / this.GRID_SIZE) * this.GRID_SIZE;
    const y = Math.round(35 / this.GRID_SIZE) * this.GRID_SIZE;
    const wall: Wall = {
      id: `wall-${Date.now()}`,
      left: x,
      top: y,
      width: this.WALL_SIZE,
      height: this.WALL_SIZE,
      rotation: 0
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
    if (this.isSidebarVisible) {
      container.style.width = 'calc(100% - 340px - 3rem)';
      if (statusBar) statusBar.style.width = 'calc(100% - 340px - 3rem)';
    } else {
      container.style.width = 'calc(100% - 3rem - 3rem)';
      if (statusBar) statusBar.style.width = 'calc(100% - 3rem - 3rem)';
    }
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
          newLeft = initialLeft + (initialWidth - newWidthBL);
          newWidth = newWidthBL;
          newHeight = Math.max(this.MIN_PLAN_SIZE, Math.min(initialHeight + deltaY, containerRect.height - this.selectedPlan.top));
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
    if (this.isPlanConfirmed) return;
    event.preventDefault();
    event.stopPropagation();
    
    // Show confirmation dialog
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
    
    // Show confirmation dialog
    if (confirm('Do you want to remove this wall?')) {
      // Remove the wall from the current plan
      if (this.currentPlan) {
        this.currentPlan.walls = this.currentPlan.walls.filter(w => w !== wall);
        
        // Clear selection if the removed wall was selected
        if (this.selectedWall === wall) {
          this.selectedWall = null;
        }
      }
    }
  }

  public confirmBooking(): void {
    if (!this.selectedDeskForBooking || !this.employeeName.trim() || this.selectedBookingDates.size === 0) {
      return;
    }

    // Create bookings for all selected dates
    this.selectedBookingDates.forEach(date => {
      const booking: Desk = {
        ...this.selectedDeskForBooking!,
        status: 'reserved',
        employeeName: this.employeeName.trim(),
        duration: this.bookingDuration,
        bookingDate: date
      };
      
      // Update the desk status for this date
      if (this.currentPlan) {
        const deskIndex = this.currentPlan.desks.findIndex(d => d.id === booking.id);
        if (deskIndex !== -1) {
          this.currentPlan.desks[deskIndex] = booking;
        }
      }
    });

    this.showBookingDialog = false;
    this.selectedDeskForBooking = null;
    this.employeeName = '';
    this.bookingDuration = '4';
    this.selectedBookingDates.clear();
  }

  public cancelBooking(): void {
    if (!this.selectedDeskForBooking) {
      return;
    }

    if (this.selectedDeskForBooking.status === 'reserved') {
      this.selectedDeskForBooking.status = 'available';
      this.selectedDeskForBooking.employeeName = undefined;
      this.selectedDeskForBooking.duration = undefined;
      this.selectedDeskForBooking.bookingDate = undefined;
    }

    this.showBookingDialog = false;
    this.selectedDeskForBooking = null;
    this.employeeName = '';
    this.bookingDuration = '4';
  }

  public closeBookingDialog(): void {
    this.showBookingDialog = false;
    this.selectedDeskForBooking = null;
    this.employeeName = '';
    this.bookingDuration = '4';
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
      this.updateDeskStatuses();
    }
  }

  private updateDeskStatuses(): void {
    if (!this.currentPlan) return;

    this.currentPlan.desks.forEach(desk => {
      if (desk.bookingDate === this.currentDate) {
        desk.status = 'reserved';
      } else {
        desk.status = 'available';
        desk.employeeName = undefined;
        desk.duration = undefined;
      }
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
    
    // Get all business days of the week
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      if (!this.isWeekend(date)) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        this.weekDates.push(dateStr);
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

  public isSelectedWeekDate(date: string): boolean {
    return this.selectedWeekDates.has(date);
  }

  private updateBookingWeekDates(): void {
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    this.bookingWeekDates = [];
    
    // Get Monday of the current week
    const monday = new Date(currentDate);
    const dayOfWeek = currentDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
    monday.setDate(currentDate.getDate() + diff);
    
    // Get business days for two weeks
    for (let week = 0; week < 2; week++) {
      for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + (week * 7) + i);
        if (!this.isWeekend(date)) {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          this.bookingWeekDates.push(dateStr);
        }
      }
    }
  }

  public isSelectedBookingDate(date: string): boolean {
    return this.selectedBookingDates.has(date);
  }

}