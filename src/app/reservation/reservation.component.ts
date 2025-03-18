import { Xliff } from '@angular/compiler';
import { Component, ElementRef, HostListener, Renderer2, ViewChild } from '@angular/core';

@Component({
  selector: 'app-reservation',
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.scss']
})
export class ReservationComponent { /*
  @ViewChild('designContainer', { static: false }) designContainer!: ElementRef;
  @ViewChild('statusBar', { static: false }) statusBar!: ElementRef;
 
  planCounter = 0;
  currentPlan: HTMLElement | null = null;
  selectedDesk: HTMLElement | null = null;
  selectedPlan: HTMLElement | null = null;
  selectedWall: HTMLElement | null = null;
  isPlanConfirmed = false;
  DESK_SIZE = 50;
  WALL_MIN_SIZE = 20;
  MIN_PLAN_SIZE = this.DESK_SIZE;
  GRID_SIZE = 10;
  INITIAL_WIDTH = 400;
  INITIAL_HEIGHT = 300;
  CONTAINER_WIDTH = 1200;
  CONTAINER_HEIGHT = 650;
  LERP_FACTOR = 0.2;
  useGridSnapping = false;
  sidebarHidden = false;

  constructor(private renderer: Renderer2) {}

  ngAfterViewInit() {
    this.updateStatusBar();
  }

  updateStatusBar() {
    const width = this.currentPlan ? parseFloat(this.currentPlan.style.width) : 0;
    const height = this.currentPlan ? parseFloat(this.currentPlan.style.height) : 0;
    const deskCount = this.currentPlan?.querySelectorAll('.desk').length || 0;
    const wallCount = this.currentPlan?.querySelectorAll('.wall').length || 0;
    const status = this.isPlanConfirmed ? ' (Confirmed)' : '';
    this.renderer.setProperty(
      this.statusBar.nativeElement,
      'textContent',
      `Plan: ${Math.round(width)}x${Math.round(height)}${status} | Desks: ${deskCount} | Walls: ${wallCount}`
    );
  }

  createPlan(x = 0, y = 0) {
    if (this.planCounter >= 1) return;
    this.planCounter++;
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
      pos.split(' ').forEach(p => this.renderer.addClass(handle, p));
      this.renderer.appendChild(plan, handle);
      this.addPlanResizeListener(plan, handle, pos);
    });

    this.renderer.appendChild(this.designContainer.nativeElement, plan);
    this.addPlanEventListeners(plan);
    this.currentPlan = plan;
    this.isPlanConfirmed = false;
    this.updateStatusBar();
  }

  addPlanEventListeners(plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;

    this.renderer.listen(plan, 'dblclick', (e: MouseEvent) => {
      if (this.isPlanConfirmed || e.target instanceof HTMLElement && (
          e.target.classList.contains('desk') || 
          e.target.classList.contains('wall') || 
          e.target.classList.contains('plan-resize-handle'))) return;
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
      if (this.isPlanConfirmed || this.selectedPlan !== plan || 
          (e.target instanceof HTMLElement && (
          e.target.classList.contains('desk') || 
          e.target.classList.contains('wall') || 
          e.target.classList.contains('plan-resize-handle') ||
          e.target.classList.contains('wall-resize-handle')))) return;
      isDragging = true;
      currentX = e.clientX - parseFloat(plan.style.left || '0');
      currentY = e.clientY - parseFloat(plan.style.top || '0');
    });

    this.renderer.listen(document, 'mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        const planWidth = parseFloat(plan.style.width);
        const planHeight = parseFloat(plan.style.height);
        const x = Math.max(0, Math.min(e.clientX - currentX, this.CONTAINER_WIDTH - planWidth));
        const y = Math.max(0, Math.min(e.clientY - currentY, this.CONTAINER_HEIGHT - planHeight));
        this.renderer.setStyle(plan, 'left', `${x}px`);
        this.renderer.setStyle(plan, 'top', `${y}px`);
      }
    });

    this.renderer.listen(document, 'mouseup', () => {
      isDragging = false;
    });

    this.renderer.listen(plan, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (!this.isPlanConfirmed && (e.target === plan || 
          (e.target instanceof HTMLElement && e.target.classList.contains('plan-resize-handle')))) {
        const planRect = plan.getBoundingClientRect();
        const x = Math.round((e.clientX - planRect.left - 10) / this.GRID_SIZE) * this.GRID_SIZE;
        const y = Math.round((e.clientY - planRect.top - 35) / this.GRID_SIZE) * this.GRID_SIZE;
        this.createDesk(plan, x, y);
      }
    });

    this.renderer.listen(this.designContainer.nativeElement, 'click', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      if (this.selectedWall && (e.target === this.selectedWall || 
          (e.target instanceof HTMLElement && e.target.classList.contains('wall-resize-handle') && 
          e.target.parentElement === this.selectedWall))) return;
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

  wouldTouchElements(plan: HTMLElement, newWidth: number, newHeight: number, newLeft: number, newTop: number): boolean {
    const newRight = newLeft + newWidth;
    const newBottom = newTop + newHeight;

    if (newLeft < 0 || newTop < 0 || newRight > this.CONTAINER_WIDTH || newBottom > this.CONTAINER_HEIGHT) return true;

    const desks = Array.from(plan.querySelectorAll('.desk'));
    const walls = Array.from(plan.querySelectorAll('.wall'));

    for (let desk of desks) {
      const deskLeft = parseFloat(desk.style.left);
      const deskTop = parseFloat(desk.style.top);
      const rotation = parseFloat(desk.dataset.rotation || '0');
      const width = 15;
      const height = 50;
      const deskRight = deskLeft + Math.max(width * Math.abs(Math.cos(rotation * Math.PI / 180)), height * Math.abs(Math.sin(rotation * Math.PI / 180)));
      const deskBottom = deskTop + Math.max(height * Math.abs(Math.cos(rotation * Math.PI / 180)), width * Math.abs(Math.sin(rotation * Math.PI / 180)));

      if (deskLeft < newLeft || deskRight > newRight || deskTop < newTop || deskBottom > newBottom) return true;
    }

    for (let wall of walls) {
      const wallLeft = parseFloat(wall.style.left);
      const wallTop = parseFloat(wall.style.top);
      const rotation = parseFloat(wall.dataset.rotation || '0');
      const wallWidth = parseFloat(wall.style.width);
      const wallHeight = parseFloat(wall.style.height);
      const wallRight = wallLeft + Math.max(wallWidth * Math.abs(Math.cos(rotation * Math.PI / 180)), wallHeight * Math.abs(Math.sin(rotation * Math.PI / 180)));
      const wallBottom = wallTop + Math.max(wallHeight * Math.abs(Math.cos(rotation * Math.PI / 180)), wallWidth * Math.abs(Math.sin(rotation * Math.PI / 180)));

      if (wallLeft < newLeft || wallRight > newRight || wallTop < newTop || wallBottom > newBottom) return true;
    }
    return false;
  }

  addPlanResizeListener(plan: HTMLElement, handle: HTMLElement, position: string) {
    let isResizing = false;
    let initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number;
    let tooltip: HTMLElement;

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

      tooltip = this.renderer.createElement('div');
      this.renderer.addClass(tooltip, 'tooltip');
      this.renderer.appendChild(document.body, tooltip);
      this.updateTooltip(e.clientX, e.clientY, plan);

      e.preventDefault();
    });

    this.renderer.listen(document, 'mousemove', (e: MouseEvent) => {
      if (!isResizing) return;

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

      if (newWidth < this.MIN_PLAN_SIZE) {
        newWidth = this.MIN_PLAN_SIZE;
        if (position.includes('left')) newLeft = initialLeft + (initialWidth - newWidth);
      }
      if (newHeight < this.MIN_PLAN_SIZE) {
        newHeight = this.MIN_PLAN_SIZE;
        if (position.includes('top')) newTop = initialTop + (initialHeight - newHeight);
      }

      if (this.wouldTouchElements(plan, newWidth, newHeight, newLeft, newTop)) {
        const desks = plan.querySelectorAll('.desk');
        const walls = plan.querySelectorAll('.wall');
        let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;

        desks.forEach(desk => {
          const deskLeft = parseFloat(desk.style.left);
          const deskTop = parseFloat(desk.style.top);
          const rotation = parseFloat(desk.dataset.rotation || '0');
          const width = 15;
          const height = 50;
          const deskRight = deskLeft + Math.max(width * Math.abs(Math.cos(rotation * Math.PI / 180)), height * Math.abs(Math.sin(rotation * Math.PI / 180)));
          const deskBottom = deskTop + Math.max(height * Math.abs(Math.cos(rotation * Math.PI / 180)), width * Math.abs(Math.sin(rotation * Math.PI / 180)));
          minLeft = Math.min(minLeft, deskLeft);
          maxRight = Math.max(maxRight, deskRight);
          minTop = Math.min(minTop, deskTop);
          maxBottom = Math.max(maxBottom, deskBottom);
        });

        walls.forEach(wall => {
          const wallLeft = parseFloat(wall.style.left);
          const wallTop = parseFloat(wall.style.top);
          const rotation = parseFloat(wall.dataset.rotation || '0');
          const wallWidth = parseFloat(wall.style.width);
          const wallHeight = parseFloat(wall.style.height);
          const wallRight = wallLeft + Math.max(wallWidth * Math.abs(Math.cos(rotation * Math.PI / 180)), wallHeight * Math.abs(Math.sin(rotation * Math.PI / 180)));
          const wallBottom = wallTop + Math.max(wallHeight * Math.abs(Math.cos(rotation * Math.PI / 180)), wallWidth * Math.abs(Math.sin(rotation * Math.PI / 180)));
          minLeft = Math.min(minLeft, wallLeft);
          maxRight = Math.max(maxRight, wallRight);
          minTop = Math.min(minTop, wallTop);
          maxBottom = Math.max(maxBottom, wallBottom);
        });

        if (position === 'top left') {
          if (newLeft > minLeft) newLeft = minLeft;
          if (newTop > minTop) newTop = minTop;
        } else if (position === 'top right') {
          if (newWidth < maxRight) newWidth = maxRight;
          if (newTop > minTop) newTop = minTop;
        } else if (position === 'bottom left') {
          if (newLeft > minLeft) newLeft = minLeft;
          if (newHeight < maxBottom) newHeight = maxBottom;
        } else if (position === 'bottom right') {
          if (newWidth < maxRight) newWidth = maxRight;
          if (newHeight < maxBottom) newHeight = maxBottom;
        }
      }

      newWidth = Math.min(newWidth, this.CONTAINER_WIDTH - newLeft);
      newHeight = Math.min(newHeight, this.CONTAINER_HEIGHT - newTop);
      newLeft = Math.max(0, Math.min(newLeft, this.CONTAINER_WIDTH - newWidth));
      newTop = Math.max(0, Math.min(newTop, this.CONTAINER_HEIGHT - newHeight));

      this.renderer.setStyle(plan, 'width', `${newWidth}px`);
      this.renderer.setStyle(plan, 'height', `${newHeight}px`);
      this.renderer.setStyle(plan, 'left', `${newLeft}px`);
      this.renderer.setStyle(plan, 'top', `${newTop}px`);

      this.updateTooltip(e.clientX, e.clientY, plan);
      this.updateStatusBar();
    });

    this.renderer.listen(document, 'mouseup', () => {
      isResizing = false;
      if (tooltip) this.renderer.removeChild(document.body, tooltip);
    });
  }

  updateTooltip(mouseX: number, mouseY: number, plan: HTMLElement) {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
      const width = parseFloat(plan.style.width);
      const height = parseFloat(plan.style.height);
      this.renderer.setProperty(tooltip, 'textContent', `${Math.round(width)}x${Math.round(height)}`);
      this.renderer.setStyle(tooltip, 'left', `${mouseX + 10}px`);
      this.renderer.setStyle(tooltip, 'top', `${mouseY - 30}px`);
    }
  }

  countTouchingElements(plan: HTMLElement, newX: number, newY: number, width: number, height: number, excludeElement: HTMLElement | null = null): number {
    const existingDesks = Array.from(plan.querySelectorAll('.desk'));
    const existingWalls = Array.from(plan.querySelectorAll('.wall'));
    let touchCount = 0;

    const newRight = newX + width;
    const newBottom = newY + height;

    for (let desk of existingDesks) {
      if (desk === excludeElement) continue;
      const deskLeft = parseFloat(desk.style.left);
      const deskTop = parseFloat(desk.style.top);
      const rotation = parseFloat(desk.dataset.rotation || '0');
      const deskWidth = 15;
      const deskHeight = 50;
      const deskRight = deskLeft + Math.max(deskWidth * Math.abs(Math.cos(rotation * Math.PI / 180)), deskHeight * Math.abs(Math.sin(rotation * Math.PI / 180)));
      const deskBottom = deskTop + Math.max(deskHeight * Math.abs(Math.cos(rotation * Math.PI / 180)), deskWidth * Math.abs(Math.sin(rotation * Math.PI / 180)));

      if ((Math.abs(newX - deskRight) < 1 && newY >= deskTop && newY < deskBottom) || 
          (Math.abs(newRight - deskLeft) < 1 && newY >= deskTop && newY < deskBottom) || 
          (Math.abs(newY - deskBottom) < 1 && newX >= deskLeft && newX < deskRight) || 
          (Math.abs(newBottom - deskTop) < 1 && newX >= deskLeft && newX < deskRight)) {
        touchCount++;
        if (!excludeElement) {
          this.renderer.addClass(desk, 'nearby');
          setTimeout(() => this.renderer.removeClass(desk, 'nearby'), 300);
        }
      }
      if (newX < deskRight && newRight > deskLeft && newY < deskBottom && newBottom > deskTop) return Infinity;
    }

    for (let wall of existingWalls) {
      if (wall === excludeElement) continue;
      const wallLeft = parseFloat(wall.style.left);
      const wallTop = parseFloat(wall.style.top);
      const rotation = parseFloat(wall.dataset.rotation || '0');
      const wallWidth = parseFloat(wall.style.width);
      const wallHeight = parseFloat(wall.style.height);
      const wallRight = wallLeft + Math.max(wallWidth * Math.abs(Math.cos(rotation * Math.PI / 180)), wallHeight * Math.abs(Math.sin(rotation * Math.PI / 180)));
      const wallBottom = wallTop + Math.max(wallHeight * Math.abs(Math.cos(rotation * Math.PI / 180)), wallWidth * Math.abs(Math.sin(rotation * Math.PI / 180)));

      if ((Math.abs(newX - wallRight) < 1 && newY >= wallTop && newY < wallBottom) || 
          (Math.abs(newRight - wallLeft) < 1 && newY >= wallTop && newY < wallBottom) || 
          (Math.abs(newY - wallBottom) < 1 && newX >= wallLeft && newX < wallRight) || 
          (Math.abs(newBottom - wallTop) < 1 && newX >= wallLeft && newX < wallRight)) {
        touchCount++;
        if (!excludeElement) {
          this.renderer.addClass(wall, 'nearby');
          setTimeout(() => this.renderer.removeClass(wall, 'nearby'), 300);
        }
      }
      if (newX < wallRight && newRight > wallLeft && newY < wallBottom && newBottom > wallTop) return Infinity;
    }

    const planWidth = parseFloat(plan.style.width);
    const planHeight = parseFloat(plan.style.height);
    if (newX < 0 || newRight > planWidth || newY < 0 || newBottom > planHeight) touchCount++;

    return touchCount;
  }

  createDesk(plan: HTMLElement, x: number, y: number) {
    const planRect = plan.getBoundingClientRect();
    let newX = Math.max(0, Math.min(x, planRect.width - 15));
    let newY = Math.max(0, Math.min(y, planRect.height - 50));
    newX = this.useGridSnapping ? Math.round(newX / this.GRID_SIZE) * this.GRID_SIZE : newX;
    newY = this.useGridSnapping ? Math.round(newY / this.GRID_SIZE) * this.GRID_SIZE : newY;

    if (this.countTouchingElements(plan, newX, newY, 15, 50) > 2) {
      let foundSpot = false;
      for (let tryX = 0; tryX <= planRect.width - 15; tryX += this.GRID_SIZE) {
        for (let tryY = 0; tryY <= planRect.height - 50; tryY += this.GRID_SIZE) {
          if (this.countTouchingElements(plan, tryX, tryY, 15, 50) <= 2) {
            newX = tryX;
            newY = tryY;
            foundSpot = true;
            break;
          }
        }
        if (foundSpot) break;
      }
      if (!foundSpot) {
        alert('No space available to add a new desk with max two elements touching!');
        return;
      }
    }

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

  createWall(plan: HTMLElement, x: number, y: number) {
    const planRect = plan.getBoundingClientRect();
    let newX = Math.max(0, Math.min(x, planRect.width - 20));
    let newY = Math.max(0, Math.min(y, planRect.height - 20));
    newX = this.useGridSnapping ? Math.round(newX / this.GRID_SIZE) * this.GRID_SIZE : newX;
    newY = this.useGridSnapping ? Math.round(newY / this.GRID_SIZE) * this.GRID_SIZE : newY;

    if (this.countTouchingElements(plan, newX, newY, 20, 20) > 2) {
      let foundSpot = false;
      for (let tryX = 0; tryX <= planRect.width - 20; tryX += this.GRID_SIZE) {
        for (let tryY = 0; tryY <= planRect.height - 20; tryY += this.GRID_SIZE) {
          if (this.countTouchingElements(plan, tryX, tryY, 20, 20) <= 2) {
            newX = tryX;
            newY = tryY;
            foundSpot = true;
            break;
          }
        }
        if (foundSpot) break;
      }
      if (!foundSpot) {
        alert('No space available to add a new wall with max two elements touching!');
        return;
      }
    }

    const wall = this.renderer.createElement('div');
    this.renderer.addClass(wall, 'wall');
    this.renderer.setStyle(wall, 'left', `${newX}px`);
    this.renderer.setStyle(wall, 'top', `${newY}px`);
    this.renderer.setStyle(wall, 'width', '20px');
    this.renderer.setStyle(wall, 'height', '20px');
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
    this.updateStatusBar();
  }

  addDeskEventListeners(desk: HTMLElement, plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;
    let rafId: number;

    this.renderer.listen(desk, 'contextmenu', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      if (this.selectedDesk && this.selectedDesk !== desk) this.renderer.removeClass(this.selectedDesk, 'selected');
      this.renderer.addClass(desk, 'selected');
      this.selectedDesk = desk;
      if (this.selectedWall) {
        this.renderer.removeClass(this.selectedWall, 'selected');
        this.selectedWall = null;
      }
    });

    this.renderer.listen(desk, 'dblclick', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.stopPropagation();
      let currentRotation = parseFloat(desk.dataset.rotation || '0');
      currentRotation = (currentRotation + 90) % 360;
      this.renderer.setAttribute(desk, 'data-rotation', `${currentRotation}`);
      this.renderer.setStyle(desk, 'transform', `rotate(${currentRotation}deg)`);
    });

    this.renderer.listen(desk, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      isDragging = true;
      currentX = e.clientX - parseFloat(desk.dataset.targetX || desk.style.left);
      currentY = e.clientY - parseFloat(desk.dataset.targetY || desk.style.top);
      this.animateDesk(desk);
    });

    this.renderer.listen(document, 'mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        let x = e.clientX - currentX;
        let y = e.clientY - currentY;

        const rotation = parseFloat(desk.dataset.rotation || '0') * Math.PI / 180;
        const baseWidth = 15;
        const baseHeight = 50;
        const cosRot = Math.abs(Math.cos(rotation));
        const sinRot = Math.abs(Math.sin(rotation));
        const effectiveWidth = baseWidth * cosRot + baseHeight * sinRot;
        const effectiveHeight = baseWidth * sinRot + baseHeight * cosRot;

        const planWidth = parseFloat(plan.style.width);
        const planHeight = parseFloat(plan.style.height);

        const offsetX = (effectiveWidth - baseWidth) / 2;
        const offsetY = (effectiveHeight - baseHeight) / 2;

        x = Math.max(-offsetX, Math.min(x, planWidth - effectiveWidth + offsetX));
        y = Math.max(-offsetY, Math.min(y, planHeight - effectiveHeight + offsetY));

        if (this.useGridSnapping) {
          x = Math.round(x / this.GRID_SIZE) * this.GRID_SIZE;
          y = Math.round(y / this.GRID_SIZE) * this.GRID_SIZE;
        }

        const touchCount = this.countTouchingElements(plan, x + offsetX, y + offsetY, effectiveWidth, effectiveHeight, desk);
        if (touchCount <= 2) {
          this.renderer.setAttribute(desk, 'data-target-x', `${x}`);
          this.renderer.setAttribute(desk, 'data-target-y', `${y}`);
        } else {
          this.renderer.addClass(desk, 'nearby');
          setTimeout(() => this.renderer.removeClass(desk, 'nearby'), 300);
        }
      }
    });

    this.renderer.listen(document, 'mouseup', () => {
      if (isDragging) {
        isDragging = false;
        cancelAnimationFrame(rafId);
        if (this.selectedDesk === desk) {
          this.renderer.removeClass(this.selectedDesk, 'selected');
          this.selectedDesk = null;
        }
      }
    });

    this.renderer.listen(desk, 'click', (e: MouseEvent) => {
      if (this.isPlanConfirmed || isDragging) return;
      e.stopPropagation();
      if (e.detail === 3 && confirm('Are you sure you want to delete this desk?')) {
        this.renderer.removeChild(plan, desk);
        if (this.selectedDesk === desk) this.selectedDesk = null;
        this.updateStatusBar();
      }
    });
  }

  animateDesk(desk: HTMLElement) {
    const currentX = parseFloat(desk.style.left) || 0;
    const currentY = parseFloat(desk.style.top) || 0;
    const targetX = parseFloat(desk.dataset.targetX || '0');
    const targetY = parseFloat(desk.dataset.targetY || '0');

    const newX = currentX + (targetX - currentX) * this.LERP_FACTOR;
    const newY = currentY + (targetY - currentY) * this.LERP_FACTOR;

    this.renderer.setStyle(desk, 'left', `${newX}px`);
    this.renderer.setStyle(desk, 'top', `${newY}px`);

    if (Math.abs(newX - targetX) > 0.1 || Math.abs(newY - targetY) > 0.1) {
      requestAnimationFrame(() => this.animateDesk(desk));
    }
  }

  addWallEventListeners(wall: HTMLElement, plan: HTMLElement) {
    let isDragging = false;
    let currentX: number, currentY: number;
    let rafId: number;

    this.renderer.listen(wall, 'contextmenu', (e: MouseEvent) => {
      if (this.isPlanConfirmed) return;
      e.preventDefault();
      if (this.selectedWall && this.selectedWall !== wall) this.renderer.removeClass(this.selectedWall, 'selected');
      this.renderer.addClass(wall, 'selected');
      this.selectedWall = wall;
      if (this.selectedDesk) {
        this.renderer.removeClass(this.selectedDesk, 'selected');
        this.selectedDesk = null;
      }
    });

    this.renderer.listen(wall, 'dblclick', (e: MouseEvent) => {
      if (this.isPlanConfirmed || (e.target instanceof HTMLElement && e.target.classList.contains('wall-resize-handle'))) return;
      e.stopPropagation();
      let currentRotation = parseFloat(wall.dataset.rotation || '0');
      currentRotation = (currentRotation + 90) % 360;
      this.renderer.setAttribute(wall, 'data-rotation', `${currentRotation}`);
      this.renderer.setStyle(wall, 'transform', `rotate(${currentRotation}deg)`);
    });

    this.renderer.listen(wall, 'mousedown', (e: MouseEvent) => {
      if (this.isPlanConfirmed || (e.target instanceof HTMLElement && e.target.classList.contains('wall-resize-handle'))) return;
      isDragging = true;
      currentX = e.clientX - parseFloat(wall.dataset.targetX || wall.style.left);
      currentY = e.clientY - parseFloat(wall.dataset.targetY || wall.style.top);
      this.animateWall(wall);
    });

    this.renderer.listen(document, 'mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        let x = e.clientX - currentX;
        let y = e.clientY - currentY;

        const rotation = parseFloat(wall.dataset.rotation || '0');
        const wallWidth = parseFloat(wall.style.width);
        const wallHeight = parseFloat(wall.style.height);
        const effectiveWidth = Math.max(wallWidth * Math.abs(Math.cos(rotation * Math.PI / 180)), wallHeight * Math.abs(Math.sin(rotation * Math.PI / 180)));
        const effectiveHeight = Math.max(wallHeight * Math.abs(Math.cos(rotation * Math.PI / 180)), wallWidth * Math.abs(Math.sin(rotation * Math.PI / 180)));
        x = Math.max(0, Math.min(x, parseFloat(plan.style.width) - effectiveWidth));
        y = Math.max(0, Math.min(y, parseFloat(plan.style.height) - effectiveHeight));

        if (this.useGridSnapping) {
          x = Math.round(x / this.GRID_SIZE) * this.GRID_SIZE;
          y = Math.round(y / this.GRID_SIZE) * this.GRID_SIZE;
        }

        const touchCount = this.countTouchingElements(plan, x, y, wallWidth, wallHeight, wall);
        if (touchCount <= 2) {
          this.renderer.setAttribute(wall, 'data-target-x', `${x}`);
          this.renderer.setAttribute(wall, 'data-target-y', `${y}`);
        } else {
          this.renderer.addClass(wall, 'nearby');
          setTimeout(() => this.renderer.removeClass(wall, 'nearby'), 300);
        }
      }
    });

    this.renderer.listen(document, 'mouseup', () => {
      if (isDragging) {
        isDragging = false;
        cancelAnimationFrame(rafId);
      }
    });

    this.renderer.listen(wall, 'click', (e: MouseEvent) => {
      if (this.isPlanConfirmed || isDragging) return;
      e.stopPropagation();
      if (e.detail === 3 && confirm('Are you sure you want to delete this wall?')) {
        this.renderer.removeChild(plan, wall);
        if (this.selectedWall === wall) this.selectedWall = null;
        this.updateStatusBar();
      }
    });
  }

  animateWall(wall: HTMLElement) {
    const currentX = parseFloat(wall.style.left) || 0;
    const currentY = parseFloat(wall.style.top) || 0;
    const targetX = parseFloat(wall.dataset.targetX || '0');
    const targetY = parseFloat(wall.dataset.targetY || '0');

    const newX = currentX + (targetX - currentX) * this.LERP_FACTOR;
    const newY = currentY + (targetY - currentY) * this.LERP_FACTOR;

    this.renderer.setStyle(wall, 'left', `${newX}px`);
    this.renderer.setStyle(wall, 'top', `${newY}px`);

    if (Math.abs(newX - targetX) > 0.1 || Math.abs(newY - targetY) > 0.1) {
      requestAnimationFrame(() => this.animateWall(wall));
    }
  }

  addWallResizeListener(wall: HTMLElement, handle: HTMLElement, position: string) {
    let isResizing = false;
    let initialX: number, initialY: number, initialWidth: number, initialHeight: number, initialLeft: number, initialTop: number;
    let tooltip: HTMLElement;

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

      tooltip = this.renderer.createElement('div');
      this.renderer.addClass(tooltip, 'tooltip');
      this.renderer.appendChild(document.body, tooltip);
      this.updateWallTooltip(e.clientX, e.clientY, wall);
    });

    this.renderer.listen(document, 'mousemove', (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();

      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;
      const rotation = parseFloat(wall.dataset.rotation || '0');
      const cosRot = Math.cos(rotation * Math.PI / 180);
      const sinRot = Math.sin(rotation * Math.PI / 180);

      let newWidth = initialWidth;
      let newHeight = initialHeight;
      let newLeft = initialLeft;
      let newTop = initialTop;

      const adjustedDeltaX = deltaX * cosRot + deltaY * sinRot;
      const adjustedDeltaY = deltaY * cosRot - deltaX * sinRot;

      switch (position) {
        case 'bottom-right':
          newWidth = initialWidth + adjustedDeltaX;
          newHeight = initialHeight + adjustedDeltaY;
          break;
        case 'top-left':
          newWidth = initialWidth - adjustedDeltaX;
          newHeight = initialHeight - adjustedDeltaY;
          newLeft = initialLeft + adjustedDeltaX;
          newTop = initialTop + adjustedDeltaY;
          break;
        case 'top-right':
          newWidth = initialWidth + adjustedDeltaX;
          newHeight = initialHeight - adjustedDeltaY;
          newTop = initialTop + adjustedDeltaY;
          break;
        case 'bottom-left':
          newWidth = initialWidth - adjustedDeltaX;
          newHeight = initialHeight + adjustedDeltaY;
          newLeft = initialLeft + adjustedDeltaX;
          break;
      }

      newWidth = Math.max(this.WALL_MIN_SIZE, Math.round(newWidth / this.GRID_SIZE) * this.GRID_SIZE);
      newHeight = Math.max(this.WALL_MIN_SIZE, Math.round(newHeight / this.GRID_SIZE) * this.GRID_SIZE);

      const planWidth = parseFloat(this.currentPlan!.style.width);
      const planHeight = parseFloat(this.currentPlan!.style.height);
      const effectiveWidth = Math.max(newWidth * Math.abs(cosRot), newHeight * Math.abs(sinRot));
      const effectiveHeight = Math.max(newHeight * Math.abs(cosRot), newWidth * Math.abs(sinRot));

      newLeft = Math.max(0, Math.min(newLeft, planWidth - effectiveWidth));
      newTop = Math.max(0, Math.min(newTop, planHeight - effectiveHeight));
      newWidth = Math.min(newWidth, planWidth - newLeft);
      newHeight = Math.min(newHeight, planHeight - newTop);

      const touchCount = this.countTouchingElements(this.currentPlan!, newLeft, newTop, effectiveWidth, effectiveHeight, wall);
      if (touchCount <= 2) {
        this.renderer.setStyle(wall, 'width', `${newWidth}px`);
        this.renderer.setStyle(wall, 'height', `${newHeight}px`);
        this.renderer.setStyle(wall, 'left', `${newLeft}px`);
        this.renderer.setStyle(wall, 'top', `${newTop}px`);
        this.renderer.setAttribute(wall, 'data-target-x', `${newLeft}`);
        this.renderer.setAttribute(wall, 'data-target-y', `${newTop}`);
      } else {
        this.renderer.addClass(wall, 'nearby');
        setTimeout(() => this.renderer.removeClass(wall, 'nearby'), 300);
      }

      this.updateWallTooltip(e.clientX, e.clientY, wall);
      this.updateStatusBar();
    });

    this.renderer.listen(document, 'mouseup', () => {
      isResizing = false;
      if (tooltip) this.renderer.removeChild(document.body, tooltip);
    });
  }

  updateWallTooltip(mouseX: number, mouseY: number, wall: HTMLElement) {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
      const width = parseFloat(wall.style.width);
      const height = parseFloat(wall.style.height);
      this.renderer.setProperty(tooltip, 'textContent', `${Math.round(width)}x${Math.round(height)}`);
      this.renderer.setStyle(tooltip, 'left', `${mouseX + 15}px`);
      this.renderer.setStyle(tooltip, 'top', `${mouseY - 35}px`);
    }
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
      this.updateStatusBar();
    }
  }

  confirmDesign() {
    if (this.currentPlan && !this.isPlanConfirmed) {
      this.isPlanConfirmed = true;
      this.renderer.addClass(this.currentPlan, 'confirmed');
      if (this.selectedPlan) this.renderer.removeClass(this.selectedPlan, 'selected');
      this.selectedPlan = null;
      const handles = this.currentPlan.querySelectorAll('.plan-resize-handle');
      handles.forEach(handle => this.renderer.addClass(handle, 'disabled'));
      const desks = this.currentPlan.querySelectorAll('.desk');
      desks.forEach(desk => this.renderer.setStyle(desk, 'cursor', 'default'));
      const walls = this.currentPlan.querySelectorAll('.wall');
      walls.forEach(wall => this.renderer.setStyle(wall, 'cursor', 'default'));
      if (this.selectedDesk) {
        this.renderer.removeClass(this.selectedDesk, 'selected');
        this.selectedDesk = null;
      }
      if (this.selectedWall) {
        this.renderer.removeClass(this.selectedWall, 'selected');
        this.selectedWall = null;
      }
      this.updateStatusBar();
    }
  }

  modifyDesign() {
    if (this.currentPlan && this.isPlanConfirmed) {
      this.isPlanConfirmed = false;
      this.renderer.removeClass(this.currentPlan, 'confirmed');
      const handles = this.currentPlan.querySelectorAll('.plan-resize-handle');
      handles.forEach(handle => this.renderer.removeClass(handle, 'disabled'));
      const desks = this.currentPlan.querySelectorAll('.desk');
      desks.forEach(desk => this.renderer.setStyle(desk, 'cursor', 'move'));
      const walls = this.currentPlan.querySelectorAll('.wall');
      walls.forEach(wall => this.renderer.setStyle(wall, 'cursor', 'pointer'));
      this.updateStatusBar();
    }
  }

  toggleSidebar() {
    this.sidebarHidden = !this.sidebarHidden;
  }
}
  */
}
