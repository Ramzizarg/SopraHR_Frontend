import { Component, ElementRef, Renderer2, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-reservation',
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.css']
})
export class ReservationComponent implements OnInit {
  @ViewChild('designContainer') designContainer!: ElementRef;

  planCounter = 0;
  currentPlan: HTMLElement | null = null;
  selectedDesk: HTMLElement | null = null;
  selectedPlan: HTMLElement | null = null;
  selectedWall: HTMLElement | null = null;
  isPlanConfirmed = false;

  readonly DESK_SIZE = 50;
  readonly WALL_MIN_SIZE = 20;
  readonly WALL_MAX_SIZE = 500;
  readonly WALL_CONNECTION_DISTANCE = 15;
  readonly MIN_PLAN_SIZE = this.DESK_SIZE;
  readonly GRID_SIZE = 10;
  readonly INITIAL_WIDTH = 400;
  readonly INITIAL_HEIGHT = 300;
  readonly CONTAINER_WIDTH = 1200;
  readonly CONTAINER_HEIGHT = 650;
  readonly LERP_FACTOR = 0.2;
  readonly SNAP_TOLERANCE = 10;
  useGridSnapping = false;

  constructor(private renderer: Renderer2) {}

  ngOnInit() {
    this.updateStatusBar();
  }

  updateStatusBar() {
    const width = this.currentPlan ? parseFloat(this.currentPlan.style.width) : 0;
    const height = this.currentPlan ? parseFloat(this.currentPlan.style.height) : 0;
    const deskCount = this.currentPlan?.querySelectorAll('.desk').length || 0;
    const wallCount = this.currentPlan?.querySelectorAll('.wall').length || 0;
    const status = this.isPlanConfirmed ? ' (Confirmed)' : '';
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
      statusBar.textContent = `Plan: ${Math.round(width)}x${Math.round(height)}${status} | Desks: ${deskCount} | Walls: ${wallCount}`;
    }
  }

  createPlan(x = 0, y = 0) {
    if (this.planCounter >= 1) return;
    this.planCounter++;
    const container = this.designContainer.nativeElement;
    const plan = this.renderer.createElement('div');
    this.renderer.addClass(plan, 'plan');
    this.renderer.setAttribute(plan, 'id', `plan-${this.planCounter}`);
    this.renderer.setStyle(plan, 'left', `${x}px`);
    this.renderer.setStyle(plan, 'top', `${y}px`);
    this.renderer.setStyle(plan, 'width', `${this.INITIAL_WIDTH}px`);
    this.renderer.setStyle(plan, 'height', `${this.INITIAL_HEIGHT}px`);

    const handles = ['top left', 'top', 'top right', 'left', 'right', 'bottom left', 'bottom', 'bottom right'];
    handles.forEach(pos => {
      const handle = this.renderer.createElement('div');
      this.renderer.addClass(handle, 'plan-resize-handle');
      pos.split(' ').forEach(cls => this.renderer.addClass(handle, cls));
      this.renderer.appendChild(plan, handle);
      this.addPlanResizeListener(plan, handle, pos);
    });

    this.renderer.appendChild(container, plan);
    this.addPlanEventListeners(plan);
    this.currentPlan = plan;
    this.isPlanConfirmed = false;

    this.toggleButtonStates(true, false, false, false, true);
    this.updateStatusBar();
  }

  addPlanEventListeners(plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;

    this.renderer.listen(plan, 'dblclick', (e: Event) => {
      if (this.isPlanConfirmed || e.target !== plan) return;
      if (this.selectedPlan !== plan) {
        if (this.selectedPlan) this.renderer.removeClass(this.selectedPlan, 'selected');
        this.renderer.addClass(plan, 'selected');
        this.selectedPlan = plan;
      }
      if (this.selectedWall) {
        this.renderer.removeClass(this.selectedWall, 'selected');
        this.selectedWall = null;
      }
    });

    this.renderer.listen(plan, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed || this.selectedPlan !== plan || e.target !== plan) return;
      isDragging = true;
      currentX = e.clientX - parseFloat(plan.style.left || '0');
      currentY = e.clientY - parseFloat(plan.style.top || '0');
      const moveListener = this.renderer.listen('document', 'mousemove', (moveEvent: MouseEvent) =>
        this.dragPlan(plan, currentX, currentY, moveEvent)
      );
      const upListener = this.renderer.listen('document', 'mouseup', () => {
        isDragging = false;
        moveListener();
        upListener();
      });
    });

    this.renderer.listen(plan, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (!this.isPlanConfirmed && e.target === plan) {
        const planRect = plan.getBoundingClientRect();
        const x = Math.round((e.clientX - planRect.left - 10) / this.GRID_SIZE) * this.GRID_SIZE;
        const y = Math.round((e.clientY - planRect.top - 35) / this.GRID_SIZE) * this.GRID_SIZE;
        this.createDesk(plan, x, y);
      }
    });

    this.renderer.listen(this.designContainer.nativeElement, 'click', (e: Event) => {
      if (this.isPlanConfirmed || e.target === this.selectedWall) return;
      if (this.selectedPlan) {
        this.renderer.removeClass(this.selectedPlan, 'selected');
        this.selectedPlan = null;
      }
      if (this.selectedWall) {
        this.renderer.removeClass(this.selectedWall, 'selected');
        this.selectedWall = null;
      }
    });
  }

  dragPlan(plan: HTMLElement, currentX: number, currentY: number, e: MouseEvent) {
    e.preventDefault();
    const planWidth = parseFloat(plan.style.width);
    const planHeight = parseFloat(plan.style.height);
    const x = Math.max(0, Math.min(e.clientX - currentX, this.CONTAINER_WIDTH - planWidth));
    const y = Math.max(0, Math.min(e.clientY - currentY, this.CONTAINER_HEIGHT - planHeight));
    this.renderer.setStyle(plan, 'left', `${x}px`);
    this.renderer.setStyle(plan, 'top', `${y}px`);
  }

  addPlanResizeListener(plan: HTMLElement, handle: HTMLElement, position: string) {
    let isResizing = false;
    let initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number;

    this.renderer.listen(handle, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed || this.selectedPlan !== plan) return;
      isResizing = true;
      const rect = plan.getBoundingClientRect();
      initialX = e.clientX;
      initialY = e.clientY;
      initialWidth = parseFloat(plan.style.width);
      initialHeight = parseFloat(plan.style.height);
      initialLeft = parseFloat(plan.style.left);
      initialTop = parseFloat(plan.style.top);

      const moveListener = this.renderer.listen('document', 'mousemove', (moveEvent: MouseEvent) =>
        this.resizePlan(plan, position, initialX, initialY, initialWidth, initialHeight, initialLeft, initialTop, moveEvent)
      );
      const upListener = this.renderer.listen('document', 'mouseup', () => {
        isResizing = false;
        moveListener();
        upListener();
      });
    });
  }

  resizePlan(plan: HTMLElement, position: string, initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number, e: MouseEvent) {
    let newWidth = initialWidth;
    let newHeight = initialHeight;
    let newLeft = initialLeft;
    let newTop = initialTop;

    const deltaX = e.clientX - initialX;
    const deltaY = e.clientY - initialY;

    switch (position) {
      case 'bottom right':
        newWidth = initialWidth + deltaX;
        newHeight = initialHeight + deltaY;
        break;
      case 'top left':
        newWidth = initialWidth - deltaX;
        newHeight = initialHeight - deltaY;
        newLeft = initialLeft + deltaX;
        newTop = initialTop + deltaY;
        break;
      case 'top right':
        newWidth = initialWidth + deltaX;
        newHeight = initialHeight - deltaY;
        newTop = initialTop + deltaY;
        break;
      case 'bottom left':
        newWidth = initialWidth - deltaX;
        newHeight = initialHeight + deltaY;
        newLeft = initialLeft + deltaX;
        break;
      case 'top':
        newHeight = initialHeight - deltaY;
        newTop = initialTop + deltaY;
        break;
      case 'bottom':
        newHeight = initialHeight + deltaY;
        break;
      case 'left':
        newWidth = initialWidth - deltaX;
        newLeft = initialLeft + deltaX;
        break;
      case 'right':
        newWidth = initialWidth + deltaX;
        break;
    }

    newWidth = Math.round(newWidth / this.GRID_SIZE) * this.GRID_SIZE;
    newHeight = Math.round(newHeight / this.GRID_SIZE) * this.GRID_SIZE;
    newWidth = Math.max(this.MIN_PLAN_SIZE, Math.min(newWidth, this.CONTAINER_WIDTH - newLeft));
    newHeight = Math.max(this.MIN_PLAN_SIZE, Math.min(newHeight, this.CONTAINER_HEIGHT - newTop));
    newLeft = Math.max(0, newLeft);
    newTop = Math.max(0, newTop);

    this.renderer.setStyle(plan, 'width', `${newWidth}px`);
    this.renderer.setStyle(plan, 'height', `${newHeight}px`);
    this.renderer.setStyle(plan, 'left', `${newLeft}px`);
    this.renderer.setStyle(plan, 'top', `${newTop}px`);
    this.updateStatusBar();
  }

  createDesk(plan: HTMLElement, x: number, y: number) {
    const planRect = plan.getBoundingClientRect();
    let newX = Math.max(0, Math.min(x, planRect.width - 15));
    let newY = Math.max(0, Math.min(y, planRect.height - this.DESK_SIZE));
    newX = this.useGridSnapping ? Math.round(newX / this.GRID_SIZE) * this.GRID_SIZE : newX;
    newY = this.useGridSnapping ? Math.round(newY / this.GRID_SIZE) * this.GRID_SIZE : newY;

    const desk = this.renderer.createElement('div');
    this.renderer.addClass(desk, 'desk');
    this.renderer.addClass(desk, 'available');
    this.renderer.setStyle(desk, 'left', `${newX}px`);
    this.renderer.setStyle(desk, 'top', `${newY}px`);
    this.renderer.setStyle(desk, 'width', '15px');
    this.renderer.setStyle(desk, 'height', `${this.DESK_SIZE}px`);
    this.renderer.setAttribute(desk, 'data-rotation', '0');
    this.renderer.setAttribute(desk, 'data-target-x', `${newX}`);
    this.renderer.setAttribute(desk, 'data-target-y', `${newY}`);

    const statusCircle = this.renderer.createElement('div');
    this.renderer.addClass(statusCircle, 'status-circle');
    this.renderer.appendChild(desk, statusCircle);

    this.addDeskEventListeners(desk, plan);
    this.renderer.appendChild(plan, desk);
    this.updateStatusBar();
  }

  addDeskEventListeners(desk: HTMLElement, plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;

    this.renderer.listen(desk, 'contextmenu', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      if (this.selectedDesk !== desk) {
        if (this.selectedDesk) this.renderer.removeClass(this.selectedDesk, 'selected');
        this.renderer.addClass(desk, 'selected');
        this.selectedDesk = desk;
      }
    });

    this.renderer.listen(desk, 'dblclick', (e: Event) => {
      if (this.isPlanConfirmed) return;
      e.stopPropagation();
      let currentRotation = parseFloat(desk.getAttribute('data-rotation') || '0');
      currentRotation = (currentRotation + 90) % 360;
      this.renderer.setAttribute(desk, 'data-rotation', `${currentRotation}`);
      this.renderer.setStyle(desk, 'transform', `rotate(${currentRotation}deg)`);
    });

    this.renderer.listen(desk, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      isDragging = true;
      currentX = e.clientX - parseFloat(desk.getAttribute('data-target-x') || desk.style.left || '0');
      currentY = e.clientY - parseFloat(desk.getAttribute('data-target-y') || desk.style.top || '0');
      const moveListener = this.renderer.listen('document', 'mousemove', (moveEvent: MouseEvent) =>
        this.dragDesk(desk, plan, currentX, currentY, moveEvent)
      );
      const upListener = this.renderer.listen('document', 'mouseup', () => {
        isDragging = false;
        moveListener();
        upListener();
      });
    });
  }

  dragDesk(desk: HTMLElement, plan: HTMLElement, currentX: number, currentY: number, e: MouseEvent) {
    e.preventDefault();
    let x = e.clientX - currentX;
    let y = e.clientY - currentY;
    const planWidth = parseFloat(plan.style.width);
    const planHeight = parseFloat(plan.style.height);
    x = Math.max(0, Math.min(x, planWidth - 15));
    y = Math.max(0, Math.min(y, planHeight - this.DESK_SIZE));
    this.renderer.setAttribute(desk, 'data-target-x', `${x}`);
    this.renderer.setAttribute(desk, 'data-target-y', `${y}`);
    this.renderer.setStyle(desk, 'left', `${x}px`);
    this.renderer.setStyle(desk, 'top', `${y}px`);
  }

  createWall(plan: HTMLElement, x: number, y: number) {
    const planRect = plan.getBoundingClientRect();
    let newX = Math.max(0, Math.min(x, planRect.width - this.WALL_MIN_SIZE));
    let newY = Math.max(0, Math.min(y, planRect.height - this.WALL_MIN_SIZE));
    newX = this.useGridSnapping ? Math.round(newX / this.GRID_SIZE) * this.GRID_SIZE : newX;
    newY = this.useGridSnapping ? Math.round(newY / this.GRID_SIZE) * this.GRID_SIZE : newY;

    const wall = this.renderer.createElement('div');
    this.renderer.addClass(wall, 'wall');
    this.renderer.setStyle(wall, 'left', `${newX}px`);
    this.renderer.setStyle(wall, 'top', `${newY}px`);
    this.renderer.setStyle(wall, 'width', `${this.WALL_MIN_SIZE}px`);
    this.renderer.setStyle(wall, 'height', `${this.WALL_MIN_SIZE}px`);
    this.renderer.setAttribute(wall, 'data-rotation', '0');
    this.renderer.setAttribute(wall, 'data-target-x', `${newX}`);
    this.renderer.setAttribute(wall, 'data-target-y', `${newY}`);

    const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    handles.forEach(pos => {
      const handle = this.renderer.createElement('div');
      this.renderer.addClass(handle, 'wall-resize-handle');
      this.renderer.addClass(handle, pos);
      this.renderer.appendChild(wall, handle);
      this.addWallResizeListener(wall, handle, pos);
    });

    this.addWallEventListeners(wall, plan);
    this.renderer.appendChild(plan, wall);
    this.checkWallConnections(wall, plan);
    this.updateStatusBar();
  }

  addWallEventListeners(wall: HTMLElement, plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;

    this.renderer.listen(wall, 'contextmenu', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      if (this.selectedWall !== wall) {
        if (this.selectedWall) this.renderer.removeClass(this.selectedWall, 'selected');
        this.renderer.addClass(wall, 'selected');
        this.selectedWall = wall;
      }
    });

    this.renderer.listen(wall, 'dblclick', (e: Event) => {
      if (this.isPlanConfirmed || (e.target as HTMLElement).classList.contains('wall-resize-handle')) return;
      e.stopPropagation();
      let currentRotation = parseFloat(wall.getAttribute('data-rotation') || '0');
      currentRotation = (currentRotation + 90) % 360;
      this.renderer.setAttribute(wall, 'data-rotation', `${currentRotation}`);
      this.renderer.setStyle(wall, 'transform', `rotate(${currentRotation}deg)`);
      this.checkWallConnections(wall, plan);
    });

    this.renderer.listen(wall, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed || (e.target as HTMLElement).classList.contains('wall-resize-handle')) return;
      isDragging = true;
      currentX = e.clientX - parseFloat(wall.getAttribute('data-target-x') || wall.style.left || '0');
      currentY = e.clientY - parseFloat(wall.getAttribute('data-target-y') || wall.style.top || '0');
      const moveListener = this.renderer.listen('document', 'mousemove', (moveEvent: MouseEvent) =>
        this.dragWall(wall, plan, currentX, currentY, moveEvent)
      );
      const upListener = this.renderer.listen('document', 'mouseup', () => {
        isDragging = false;
        moveListener();
        upListener();
      });
    });
  }

  dragWall(wall: HTMLElement, plan: HTMLElement, currentX: number, currentY: number, e: MouseEvent) {
    e.preventDefault();
    let x = e.clientX - currentX;
    let y = e.clientY - currentY;
    const wallWidth = parseFloat(wall.style.width);
    const wallHeight = parseFloat(wall.style.height);
    const planWidth = parseFloat(plan.style.width);
    const planHeight = parseFloat(plan.style.height);
    x = Math.max(0, Math.min(x, planWidth - wallWidth));
    y = Math.max(0, Math.min(y, planHeight - wallHeight));
    this.renderer.setAttribute(wall, 'data-target-x', `${x}`);
    this.renderer.setAttribute(wall, 'data-target-y', `${y}`);
    this.renderer.setStyle(wall, 'left', `${x}px`);
    this.renderer.setStyle(wall, 'top', `${y}px`);
    this.checkWallConnections(wall, plan);
  }

  addWallResizeListener(wall: HTMLElement, handle: HTMLElement, position: string) {
    let isResizing = false;
    let initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number;

    this.renderer.listen(handle, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed || this.selectedWall !== wall) return;
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      const rect = wall.getBoundingClientRect();
      initialX = e.clientX;
      initialY = e.clientY;
      initialWidth = parseFloat(wall.style.width);
      initialHeight = parseFloat(wall.style.height);
      initialLeft = parseFloat(wall.style.left);
      initialTop = parseFloat(wall.style.top);

      const moveListener = this.renderer.listen('document', 'mousemove', (moveEvent: MouseEvent) =>
        this.resizeWall(wall, position, initialX, initialY, initialWidth, initialHeight, initialLeft, initialTop, moveEvent)
      );
      const upListener = this.renderer.listen('document', 'mouseup', () => {
        isResizing = false;
        moveListener();
        upListener();
      });
    });
  }

  resizeWall(wall: HTMLElement, position: string, initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number, e: MouseEvent) {
    const deltaX = e.clientX - initialX;
    const deltaY = e.clientY - initialY;
    const rotation = parseFloat(wall.getAttribute('data-rotation') || '0');
    const cosRot = Math.cos(rotation * Math.PI / 180);
    const sinRot = Math.sin(rotation * Math.PI / 180);
    const adjustedDeltaX = deltaX * cosRot + deltaY * sinRot;
    const adjustedDeltaY = deltaY * cosRot - deltaX * sinRot;

    let newWidth = initialWidth;
    let newHeight = initialHeight;
    let newLeft = initialLeft;
    let newTop = initialTop;

    const planWidth = parseFloat(this.currentPlan!.style.width);
    const planHeight = parseFloat(this.currentPlan!.style.height);

    switch (position) {
      case 'bottom-right':
        newWidth = initialWidth + adjustedDeltaX;
        newHeight = initialHeight + adjustedDeltaY;
        newWidth = Math.max(this.WALL_MIN_SIZE, Math.min(newWidth, planWidth - initialLeft));
        newHeight = Math.max(this.WALL_MIN_SIZE, Math.min(newHeight, planHeight - initialTop));
        break;
      case 'top-left':
        newWidth = initialWidth - adjustedDeltaX;
        newHeight = initialHeight - adjustedDeltaY;
        newLeft = initialLeft + adjustedDeltaX;
        newTop = initialTop + adjustedDeltaY;
        newWidth = Math.max(this.WALL_MIN_SIZE, newWidth);
        newHeight = Math.max(this.WALL_MIN_SIZE, newHeight);
        newLeft = Math.max(0, initialLeft - (newWidth - initialWidth));
        newTop = Math.max(0, initialTop - (newHeight - initialHeight));
        break;
      case 'top-right':
        newWidth = initialWidth + adjustedDeltaX;
        newHeight = initialHeight - adjustedDeltaY;
        newTop = initialTop + adjustedDeltaY;
        newWidth = Math.max(this.WALL_MIN_SIZE, Math.min(newWidth, planWidth - initialLeft));
        newHeight = Math.max(this.WALL_MIN_SIZE, newHeight);
        newTop = Math.max(0, initialTop - (newHeight - initialHeight));
        break;
      case 'bottom-left':
        newWidth = initialWidth - adjustedDeltaX;
        newHeight = initialHeight + adjustedDeltaY;
        newLeft = initialLeft + adjustedDeltaX;
        newWidth = Math.max(this.WALL_MIN_SIZE, newWidth);
        newHeight = Math.max(this.WALL_MIN_SIZE, Math.min(newHeight, planHeight - initialTop));
        newLeft = Math.max(0, initialLeft - (newWidth - initialWidth));
        break;
    }

    newWidth = Math.round(newWidth / this.GRID_SIZE) * this.GRID_SIZE;
    newHeight = Math.round(newHeight / this.GRID_SIZE) * this.GRID_SIZE;

    this.renderer.setStyle(wall, 'width', `${newWidth}px`);
    this.renderer.setStyle(wall, 'height', `${newHeight}px`);
    this.renderer.setStyle(wall, 'left', `${newLeft}px`);
    this.renderer.setStyle(wall, 'top', `${newTop}px`);
    this.renderer.setAttribute(wall, 'data-target-x', `${newLeft}`);
    this.renderer.setAttribute(wall, 'data-target-y', `${newTop}`);
    this.checkWallConnections(wall, this.currentPlan!);
    this.updateStatusBar();
  }

  checkWallConnections(currentWall: HTMLElement, plan: HTMLElement) {
    const walls = Array.from(plan.querySelectorAll('.wall'));
    const currentRect = currentWall.getBoundingClientRect();
    const currentRotation = parseFloat(currentWall.getAttribute('data-rotation') || '0');
    const currentWidth = parseFloat(currentWall.style.width);
    const currentHeight = parseFloat(currentWall.style.height);

    walls.forEach(wall => this.renderer.removeClass(wall, 'connected'));

    walls.forEach(otherWall => {
      if (otherWall === currentWall) return;
      const otherRect = otherWall.getBoundingClientRect();
      const otherRotation = parseFloat(otherWall.getAttribute('data-rotation') || '0');
      const dx = Math.abs(currentRect.left + currentWidth / 2 - (otherRect.left + otherRect.width / 2));
      const dy = Math.abs(currentRect.top + currentHeight / 2 - (otherRect.top + otherRect.height / 2));
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.WALL_CONNECTION_DISTANCE && Math.abs(currentRotation - otherRotation) % 180 === 0) {
        this.renderer.addClass(currentWall, 'connected');
        this.renderer.addClass(otherWall, 'connected');
      }
    });
  }

  deletePlan() {
    if (this.currentPlan) {
      this.renderer.removeChild(this.designContainer.nativeElement, this.currentPlan);
      this.currentPlan = null;
      this.selectedPlan = null;
      this.selectedDesk = null;
      this.selectedWall = null;
      this.planCounter = 0;
      this.isPlanConfirmed = false;
      this.toggleButtonStates(false, true, true, true, true);
      this.updateStatusBar();
    }
  }

  confirmDesign() {
    if (this.currentPlan && !this.isPlanConfirmed) {
      this.isPlanConfirmed = true;
      this.renderer.addClass(this.currentPlan, 'confirmed');
      if (this.selectedPlan) this.renderer.removeClass(this.selectedPlan, 'selected');
      this.selectedPlan = null;
      this.toggleButtonStates(true, true, false, true, false);
      this.updateStatusBar();
    }
  }

  modifyDesign() {
    if (this.currentPlan && this.isPlanConfirmed) {
      this.isPlanConfirmed = false;
      this.renderer.removeClass(this.currentPlan, 'confirmed');
      this.toggleButtonStates(true, false, false, false, true);
      this.updateStatusBar();
    }
  }

  toggleSidebar(visible: boolean) {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const openButton = document.getElementById('openSidebarButton') as HTMLElement;
    const statusBar = document.getElementById('statusBar') as HTMLElement;
    const designContainer = this.designContainer.nativeElement;

    if (visible) {
      this.renderer.removeClass(sidebar, 'hidden');
      this.renderer.setStyle(openButton, 'display', 'none');
      this.renderer.removeClass(statusBar, 'shifted');
      this.renderer.removeClass(designContainer, 'shifted');
    } else {
      this.renderer.addClass(sidebar, 'hidden');
      this.renderer.setStyle(openButton, 'display', 'block');
      this.renderer.addClass(statusBar, 'shifted');
      this.renderer.addClass(designContainer, 'shifted');
    }
  }

  toggleButtonStates(createPlan: boolean, createWall: boolean, deletePlan: boolean, confirmDesign: boolean, modify: boolean) {
    const buttons = {
      createPlanButton: createPlan,
      createWallButton: createWall,
      deletePlanButton: deletePlan,
      confirmDesignButton: confirmDesign,
      modifyButton: modify
    };
    Object.entries(buttons).forEach(([id, disabled]) => {
      const button = document.getElementById(id);
      if (button) this.renderer.setProperty(button, 'disabled', disabled);
    });
  }
}