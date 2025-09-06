import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../login/AuthService';
import { DatePipe } from '@angular/common';
import { Subscription, fromEvent, takeUntil, take } from 'rxjs';
import Swal from 'sweetalert2';
import { UserService } from '../users/user.service';
import { ReservationService, Desk as ApiDesk, Plan as ApiPlan, Wall as ApiWall, Reservation } from '../../reservation/reservation.service';
import { ContactService, ContactRequest } from '../../services/contact.service';
import { UserProfile } from '../../login/AuthService';



export interface Desk {
  id: number;
  left: number;
  top: number;
  rotation: number;
  moving?: boolean;
  available?: boolean; // True if available, false if reserved
  employeeName?: string;
  duration?: 'AM' | 'PM' | 'FULL'; // AM for 8h-12h, PM for 14h-18h, FULL for 8h-18h
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

export interface WeeklyStatus {
  date: string;
  status: 'available' | 'reserved' | 'own';
}

export interface TooltipData {
  x: number;
  y: number;
  type: 'simple' | 'weekly';
  simpleContent?: string;
  status?: 'available' | 'reserved' | 'info' | 'own';
  weeklyStatus?: WeeklyStatus[];
}

@Component({
  selector: 'app-reservation-back',
  templateUrl: './reservation-back.component.html',
  styleUrls: ['./reservation-back.component.css', '../../reservation/tooltip.css'],
  providers: [DatePipe]
})
export class ReservationBackComponent implements OnInit, AfterViewInit {
  @ViewChild('profileElement') profileElement!: ElementRef;
  
  // Sidebar and UI states
  isSidebarOpen: boolean = true;
  isProfileDropdownOpen: boolean = false;
  searchTerm: string = '';
  
  // Date formatting
  today: Date = new Date();
  formattedDate: string = '';
  
  // Loading states
  isLoading: boolean = false;
  error: string | null = null;
  private subscriptions: Subscription = new Subscription();

  // Profile photo storage
  userProfilePhotos: Map<number, string> = new Map(); // Store user profile photos by userId

  constructor(
    public authService: AuthService,
    private reservationService: ReservationService,
    private router: Router,
    private contactService: ContactService,
    private userService: UserService,
    private datePipe: DatePipe
  ) {
    this.formattedDate = this.datePipe.transform(this.today, 'dd MMMM yyyy') || '';
  }

  ngOnInit(): void {
    // Load any stored profile photo from localStorage
    this.loadStoredProfilePhoto();
    
    // Fetch latest profile photo from server
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }

    // Initialize sidebar state
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);
    
    // Additional logic from second version
    this.setupKeyboardListeners();
    this.syncContainerWidths();
    this.setupDocumentClickHandler();
    
    // Add resize event listener to handle container size on viewport changes
    window.addEventListener('resize', this.resizeHandler);
    
    // Add specific event listener for when dev tools are closed
    this.setupDevToolsCloseListener();

    // Check if the user is an admin
    this.authService.currentUser.subscribe({
      next: (user: UserProfile | null) => {
        if (user) {
          this.currentUser = user;
          // Set isAdmin flag based on user role
          this.isAdmin = user.role === 'ADMIN' || user.role === 'ROLE_ADMIN';
          console.log('User has admin role:', this.isAdmin);
          
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
   * Load stored profile photo from localStorage
   */
  loadStoredProfilePhoto(): void {
    // Check if there's a stored profile photo URL in localStorage
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const storedPhotoUrl = localStorage.getItem(`profilePhoto_${currentUser.id}`);
      if (storedPhotoUrl) {
        // Update the user object in auth service
        currentUser.profilePhotoUrl = storedPhotoUrl;
        this.authService.updateCurrentUser(currentUser);
      }
    }
  }
  
  /**
   * Fetch profile photo for a specific user and store it in the userProfilePhotos map
   * @param userId The ID of the user
   */
  fetchUserProfilePhoto(userId: number): void {
    this.userService.getUserProfilePhoto(userId).subscribe({
      next: (photoUrl) => {
        if (photoUrl) {
          this.userProfilePhotos.set(userId, photoUrl);
          // If this is the current user, also update their profile in the auth service
          if (this.authService.currentUserValue?.id === userId) {
            this.authService.currentUserValue.profilePhotoUrl = photoUrl;
            // Store in localStorage for persistence
            localStorage.setItem(`profilePhoto_${userId}`, photoUrl);
            // Force UI update
            this.authService.updateCurrentUser(this.authService.currentUserValue);
          }
        }
      },
      error: (error) => {
        console.error('Error fetching profile photo for user', userId, error);
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
   * Toggle profile dropdown visibility
   */
  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }
  
  /**
   * Close profile dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event): void {
    if (this.profileElement && !this.profileElement.nativeElement.contains(event.target)) {
      this.isProfileDropdownOpen = false;
    }
  }
  
  /**
   * Clean up subscriptions when component is destroyed
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
    this.subscriptions.unsubscribe();
  }

  /**
   * Toggle sidebar open/closed state
   */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Handle image loading error (for profile image)
   */
  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
    }
  }

  /**
   * Edit user profile
   */
  editProfile(): void {
    // Close the dropdown menu
    this.isProfileDropdownOpen = false;
    
    // Create a more visually appealing dialog for profile photo upload with cropping feature
    Swal.fire({
      title: 'Modifier le profil',
      html: `
        <div class="profile-edit-container">
          <div class="current-photo-container mb-2">
            <div class="current-photo" id="currentPhotoPreview" onclick="document.getElementById('profilePhoto').click()">
              ${this.authService.currentUserValue?.profilePhotoUrl ? 
                `<img src="${this.authService.currentUserValue?.profilePhotoUrl}" alt="Current Profile">` : 
                `<div class="avatar-preview">${this.authService.currentUserValue?.firstName?.charAt(0) || ''}${this.authService.currentUserValue?.lastName?.charAt(0) || ''}</div>`
              }
              <div class="photo-edit-overlay">
                <i class="bi bi-camera-fill"></i>
              </div>
            </div>
            <div class="photo-instructions">Cliquez sur la photo pour modifier</div>
          </div>
          <div class="mb-3" style="display: none;">
            <input type="file" class="form-control" id="profilePhoto" accept="image/*" onchange="handleImageSelection(event)">
          </div>
          
          <!-- Image Cropping Container -->
          <div id="cropContainer" style="display: none;" class="crop-container">
            <div class="crop-header">Recadrer la photo</div>
            <div class="crop-area" id="cropArea">
              <canvas id="cropCanvas"></canvas>
              <div id="cropOverlay" class="crop-overlay"></div>
            </div>
            <div class="crop-controls mt-2">
              <button id="rotateLeftBtn" class="crop-btn" title="Tourner à gauche">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button id="zoomOutBtn" class="crop-btn" title="Zoom arrière">
                <i class="bi bi-dash-circle"></i>
              </button>
              <button id="zoomInBtn" class="crop-btn" title="Zoom avant">
                <i class="bi bi-plus-circle"></i>
              </button>
              <button id="rotateRightBtn" class="crop-btn" title="Tourner à droite">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
            <div class="crop-actions mt-2">
              <button id="cancelCropBtn" class="btn btn-sm btn-light">Annuler</button>
              <button id="applyCropBtn" class="btn btn-sm btn-primary">Appliquer</button>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      },
      didOpen: () => {
        // Add script to handle image selection, preview, and cropping
        const script = document.createElement('script');
        script.textContent = `
          // Global variables for cropping
          let originalImage = null;
          let croppedImage = null;
          let cropCanvas = null;
          let cropContext = null;
          let scale = 1;
          let rotation = 0;
          let dragStartX = 0;
          let dragStartY = 0;
          let imgX = 0;
          let imgY = 0;
          let dragging = false;
          const cropSize = 200; // Size of the crop area
          
          // Initial file selection
          function handleImageSelection(event) {
            const file = event.target.files[0];
            if (file) {
              // Hide the preview and show the cropper
              const reader = new FileReader();
              reader.onload = function(e) {
                // Load the image to get dimensions
                originalImage = new Image();
                originalImage.onload = function() {
                  // Setup the cropping interface
                  setupCropper(originalImage);
                  
                  // Show cropping container
                  document.getElementById('cropContainer').style.display = 'block';
                  document.getElementById('currentPhotoPreview').style.display = 'none';
                  document.querySelector('.photo-instructions').style.display = 'none';
                };
                originalImage.src = e.target.result;
              };
              reader.readAsDataURL(file);
            }
          }
          
          // Setup the cropping interface
          function setupCropper(image) {
            cropCanvas = document.getElementById('cropCanvas');
            cropContext = cropCanvas.getContext('2d');
            
            // Set canvas size to fit the crop area
            cropCanvas.width = cropSize;
            cropCanvas.height = cropSize;
            
            // Initial positioning to center the image
            const scaleFactor = Math.max(cropSize / image.width, cropSize / image.height);
            scale = scaleFactor * 0.8; // Start slightly zoomed out
            
            // Center the image initially
            imgX = (cropSize - (image.width * scale)) / 2;
            imgY = (cropSize - (image.height * scale)) / 2;
            
            // Draw the image with initial settings
            drawImage();
            
            // Setup event listeners for cropping
            setupCropperControls();
          }
          
          // Draw the image with current transformations
          function drawImage() {
            if (!originalImage) return;
            
            // Clear the canvas
            cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
            
            // Save the context state
            cropContext.save();
            
            // Translate to center for rotation
            cropContext.translate(cropSize/2, cropSize/2);
            cropContext.rotate(rotation * Math.PI / 180);
            
            // Draw the image centered and scaled
            cropContext.drawImage(
              originalImage, 
              -originalImage.width * scale / 2 + imgX, 
              -originalImage.height * scale / 2 + imgY, 
              originalImage.width * scale, 
              originalImage.height * scale
            );
            
            // Restore the context
            cropContext.restore();
          }
          
          // Setup all cropper controls
          function setupCropperControls() {
            // Zoom buttons
            document.getElementById('zoomInBtn').addEventListener('click', () => {
              scale *= 1.1;
              drawImage();
            });
            
            document.getElementById('zoomOutBtn').addEventListener('click', () => {
              scale *= 0.9;
              drawImage();
            });
            
            // Rotation buttons
            document.getElementById('rotateLeftBtn').addEventListener('click', () => {
              rotation -= 90;
              drawImage();
            });
            
            document.getElementById('rotateRightBtn').addEventListener('click', () => {
              rotation += 90;
              drawImage();
            });
            
            // Mouse controls for dragging
            cropCanvas.addEventListener('mousedown', (e) => {
              dragging = true;
              dragStartX = e.clientX;
              dragStartY = e.clientY;
            });
            
            document.addEventListener('mousemove', (e) => {
              if (dragging) {
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                
                imgX += dx;
                imgY += dy;
                
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                
                drawImage();
              }
            });
            
            document.addEventListener('mouseup', () => {
              dragging = false;
            });
            
            // Apply and cancel buttons
            document.getElementById('applyCropBtn').addEventListener('click', applyCrop);
            document.getElementById('cancelCropBtn').addEventListener('click', cancelCrop);
          }
          
          // Apply the crop and show the cropped image
          function applyCrop() {
            // Create a circular crop
            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');
            tempCanvas.width = cropSize;
            tempCanvas.height = cropSize;
            
            // Copy the main canvas
            tempContext.drawImage(cropCanvas, 0, 0);
            
            // Create circle clipping
            const finalCanvas = document.createElement('canvas');
            const finalContext = finalCanvas.getContext('2d');
            finalCanvas.width = cropSize;
            finalCanvas.height = cropSize;
            
            finalContext.beginPath();
            finalContext.arc(cropSize/2, cropSize/2, cropSize/2, 0, Math.PI * 2);
            finalContext.closePath();
            finalContext.clip();
            finalContext.drawImage(tempCanvas, 0, 0);
            
            // Get the data URL of the cropped image
            const croppedDataUrl = finalCanvas.toDataURL('image/png');
            
            // Update the preview with the cropped image
            const currentPhotoPreview = document.getElementById('currentPhotoPreview');
            currentPhotoPreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = croppedDataUrl;
            img.alt = 'Cropped Profile';
            currentPhotoPreview.appendChild(img);
            
            // Add back the camera overlay
            const overlay = document.createElement('div');
            overlay.className = 'photo-edit-overlay';
            overlay.innerHTML = '<i class="bi bi-camera-fill"></i>';
            currentPhotoPreview.appendChild(overlay);
            
            // Hide crop container and show preview
            document.getElementById('cropContainer').style.display = 'none';
            document.getElementById('currentPhotoPreview').style.display = 'flex';
            document.querySelector('.photo-instructions').style.display = 'block';
            document.querySelector('.photo-instructions').textContent = 'Photo recadrée (cliquez pour changer)';
            
            // Convert data URL to Blob/File for upload
            const arr = croppedDataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            
            const blob = new Blob([u8arr], { type: mime });
            const file = new File([blob], 'cropped-profile.png', { type: 'image/png' });
            
            // Create a new file input event
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('profilePhoto').files = dataTransfer.files;
          }
          
          // Cancel cropping and go back to preview
          function cancelCrop() {
            document.getElementById('cropContainer').style.display = 'none';
            document.getElementById('currentPhotoPreview').style.display = 'flex';
            document.querySelector('.photo-instructions').style.display = 'block';
            
            // Reset file input
            document.getElementById('profilePhoto').value = '';
          }
          
          // Basic preview for initial photo selection
          function previewProfileImage(event) {
            const file = event.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = function(e) {
                const currentPhotoPreview = document.getElementById('currentPhotoPreview');
                if (currentPhotoPreview) {
                  // Clear current photo content
                  currentPhotoPreview.innerHTML = '';
                  
                  // Create and append new image
                  const newImg = document.createElement('img');
                  newImg.src = e.target.result;
                  newImg.alt = 'New Profile Photo';
                  currentPhotoPreview.appendChild(newImg);
                  
                  // Re-add the camera overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'photo-edit-overlay';
                  overlay.innerHTML = '<i class="bi bi-camera-fill"></i>';
                  currentPhotoPreview.appendChild(overlay);
                  
                  // Update instructions text
                  const instructionsEl = document.querySelector('.photo-instructions');
                  if (instructionsEl) {
                    instructionsEl.textContent = 'Photo sélectionnée (cliquez pour changer)';
                  }
                }
              }
              reader.readAsDataURL(file);
            }
          }
        `;
        document.body.appendChild(script);
        
        // Add style for the preview elements and cropping interface
        const style = document.createElement('style');
        style.textContent = `
          .profile-edit-container {
            padding: 0.5rem 0.5rem 0;
          }
          .current-photo-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .current-photo {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            overflow: hidden;
            margin-bottom: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .current-photo:hover {
            box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
          }
          .current-photo:hover .photo-edit-overlay {
            opacity: 1;
          }
          .current-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .avatar-preview {
            width: 100%;
            height: 100%;
            background-color: #3B82F6;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 500;
          }
          .photo-edit-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          .photo-edit-overlay i {
            color: white;
            font-size: 1.5rem;
          }
          .photo-instructions {
            font-size: 0.8rem;
            color: #6B7280;
            margin-bottom: 1rem;
            text-align: center;
          }
          .crop-container {
            display: none;
            flex-direction: column;
            align-items: center;
            max-width: 100%;
            margin: 0 auto;
          }
          .crop-header {
            font-size: 14px;
            font-weight: 500;
            color: #4B5563;
            margin-bottom: 8px;
            text-align: center;
          }
          .crop-area {
            position: relative;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            margin: 0 auto;
          }
          #cropCanvas {
            width: 100%;
            height: 100%;
            display: block;
            cursor: move;
            touch-action: none; /* Prevent touch scrolling */
          }
          .crop-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 2px dashed rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            box-sizing: border-box;
            pointer-events: none;
          }
          .crop-controls {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 10px;
          }
          .crop-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background-color: #F3F4F6;
            border: 1px solid #E5E7EB;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .crop-btn:hover {
            background-color: #E5E7EB;
          }
          .crop-btn i {
            font-size: 16px;
            color: #4B5563;
          }
          .crop-actions {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 12px;
          }
          .crop-actions .btn {
            font-size: 12px;
            padding: 4px 12px;
          }
        `;
        document.head.appendChild(style);
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // Get the cropped image file if available
        const profilePhotoInput = document.getElementById('profilePhoto') as HTMLInputElement;
        const profilePhoto = profilePhotoInput.files ? profilePhotoInput.files[0] : null;
        
        // Get updated profile info
        const firstName = document.querySelector('.swal2-container input#firstName') as HTMLInputElement;
        const lastName = document.querySelector('.swal2-container input#lastName') as HTMLInputElement;
        
        if (profilePhoto) {
          // Here you would upload the photo to your server
          console.log('Profile photo selected', profilePhoto);
          
          // Create FormData and append the file and other profile details
          const formData = new FormData();
          formData.append('profilePhoto', profilePhoto);
          formData.append('firstName', firstName?.value || this.authService.currentUserValue?.firstName || '');
          formData.append('lastName', lastName?.value || this.authService.currentUserValue?.lastName || '');
          
          // Show success message (in real implementation, this would be shown after API call)
          Swal.fire({
            icon: 'success',
            title: 'Profil mis à jour',
            showConfirmButton: false,
            timer: 1500
          });
        } else {
          // Just update name if no photo was selected
          // Your code to update just the name
          Swal.fire({
            icon: 'success',
            title: 'Profil mis à jour',
            showConfirmButton: false,
            timer: 1500
          });
        }
      }
    });
  }

  /**
   * Open account settings
   */
  openAccountSettings(): void {
    Swal.fire('Account Settings', 'Account settings functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }

  /**
   * Get support
   */
  getSupport(): void {
    Swal.fire('Support', 'Support functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }

  /**
   * Logout user
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Load data
   */
  loadData(): void {
    this.isLoading = true;
    this.error = null;
    
    // Implement your data loading logic here
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 1024) {
      this.isSidebarOpen = true;
      document.body.classList.remove('sidebar-collapsed-layout');
    } else {
      this.isSidebarOpen = false;
      document.body.classList.add('sidebar-collapsed-layout');
    }
  }

 // Contact modal properties
 isContactModalOpen = false;
 private currentUser: UserProfile | null = null;
 public isAdmin: boolean = false;
 @ViewChild('designContainer') designContainer?: ElementRef<HTMLElement>;
 @ViewChild('statusBar', { static: true }) statusBar!: ElementRef<HTMLElement>;
 
 public plans: Plan[] = [];
 public currentPlan: Plan | null = null;
 public selectedPlan: Plan | null = null;
 public selectedDesk: Desk | null = null;
 public selectedWall: Wall | null = null;
 public isPlanConfirmed = false;
 public isMobileMenuOpen = false;
 public isSidebarVisible = true; // Always visible now
 public resizeHandles = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'];

 private readonly GRID_SIZE = 10;
 private readonly INITIAL_WIDTH = 1065; // Fixed plan width
 private readonly INITIAL_HEIGHT = 570; // Fixed plan height
 private readonly DESK_WIDTH = 15;
 private readonly DESK_HEIGHT = 50;
 private readonly WALL_SIZE = 20;
 private readonly KEYBOARD_MOVE_SPEED = 1; // Always use 1px movement for maximum precision
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
 public bookingDuration: 'AM' | 'PM' | 'FULL' = 'AM';
 public currentDate = '';

 private readonly MAX_FUTURE_DAYS = 14; // Maximum two weeks in the future
 private readonly MAX_PAST_DAYS = 0;    // No past days allowed

 public viewMode: 'week' | 'day' = 'day';
 public weekDates: string[] = [];
 public selectedWeekDates: Set<string> = new Set();
 public selectedBookingDates = new Set<string>();
 public bookingWeekDates: string[] = [];
 public deskReservationDates = new Set<string>();
 public selectedDeskReservations: Reservation[] = [];
 public reservationsByDate: Map<string, Reservation[]> = new Map<string, Reservation[]>();
 
 // Track initial user reservations for determining updates/deletions
 private initialUserReservations = new Set<string>();
 private userReservationIds = new Map<string, number>();
 
 // Track current reservation operations
 private datesToCreate: string[] = [];
 private datesToDelete: string[] = [];

 // Add private property to store the resize handler reference
 private resizeHandler = () => {
   this.syncContainerWidths();
   this.updateContainerWidths();
 };



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
 }

 // Toggle mobile menu
 toggleMobileMenu(event: Event) {
   event.preventDefault();
   this.isMobileMenuOpen = !this.isMobileMenuOpen;
 }


 
 /**
  * Cleanup resources when component is destroyed
  */
  // Background image rotation is now handled by CSS

 private syncContainerWidths(): void {
    if (this.designContainer && this.statusBar) {
      // Ensure the widths of the design container and status bar are in sync
      const containerRect = this.designContainer ? this.designContainer.nativeElement.getBoundingClientRect() : { width: 0 };
      const exactWidth = containerRect.width;
      // Set exact pixel width to ensure they match perfectly
      if (this.statusBar) {
        this.statusBar.nativeElement.style.width = `${exactWidth}px`;
        // Force a repaint to ensure dimensions update correctly
        this.forceRepaint(this.statusBar.nativeElement);
        console.log('Synchronized widths - Design Container:', exactWidth, 'Status Bar:', this.statusBar.nativeElement.offsetWidth);
      }
      if (this.designContainer) {
        this.forceRepaint(this.designContainer.nativeElement);
      }
    }
  }

 private updateContainerWidths(): void {
   if (this.designContainer && this.statusBar) {
     const container = this.designContainer.nativeElement;
     const statusBar = this.statusBar.nativeElement;
     
     // Get window width to determine responsive behavior
     const windowWidth = window.innerWidth;
     
     // Get the computed style to use consistent sizing
     const containerWidth = container.offsetWidth;
     statusBar.style.width = `${containerWidth}px`;
     
     if (!this.isAdmin) {
       // For non-admins with hidden sidebar
       container.style.marginLeft = 'auto';
       container.style.marginRight = 'auto';
       statusBar.style.marginLeft = 'auto';
       statusBar.style.marginRight = 'auto';
     } else {
       // For admins with visible sidebar - responsive margins
       if (windowWidth <= 768) {
         // Mobile view - center the container
         container.style.marginLeft = 'auto';
         container.style.marginRight = 'auto';
         statusBar.style.marginLeft = 'auto';
         statusBar.style.marginRight = 'auto';
         container.style.left = '0';
         statusBar.style.left = '0';
       } else if (windowWidth <= 992) {
         // Tablet view - reduced sidebar width
         container.style.marginLeft = '200px';
         container.style.marginRight = '';
         statusBar.style.marginLeft = '200px';
         statusBar.style.marginRight = '';
       } else {
         // Desktop view - full sidebar width
         container.style.marginLeft = '340px';
         container.style.marginRight = '';
         statusBar.style.marginLeft = '340px';
         statusBar.style.marginRight = '';
       }
     }
     
     // Update max-width for very large screens
     if (windowWidth > 1400) {
       container.style.maxWidth = '1200px';
       statusBar.style.maxWidth = '1200px';
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
       this.isLoading = false;
       if (apiPlans && apiPlans.length > 0) {
         // Convert API plans to UI plans with fixed position and size
         this.plans = apiPlans.map(apiPlan => {
           const plan: Plan = {
             id: apiPlan.id?.toString() || `plan-${++this.planCounter}`,
             left: 10, // Always fixed position
             top: 10,  // Always fixed position
             width: 1135, // Fixed width
             height: 580, // Fixed height
             desks: [],
             walls: []
           };
           return plan;
         });
         this.currentPlan = this.plans[0];
         this.selectedPlan = null; // Don't automatically select the plan
         this.isPlanConfirmed = true; // Plans from server are always confirmed
         
         // Load desks and walls for this plan
         this.loadDesksAndWalls(apiPlans[0].id!);
       } else {
         // No plans found, but don't automatically create one
         if (this.authService.isAdmin()) {
           // Show a message to the admin that they can create a plan
           Swal.fire({
             title: 'No Floor Plans Available',
             text: 'You can create a new floor plan using the "Create New Plan" button.',
             icon: 'info',
             confirmButtonText: 'OK'
           });
         } else {
           Swal.fire({
             title: 'No Floor Plans Available',
             text: 'Please contact an admin to create a floor plan.',
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
       
       // Use getAllReservationsInDateRange instead of getUserReservationsInDateRange to show all users' reservations
       this.reservationService.getAllReservationsInDateRange(startDate, endDate).subscribe({
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
       desk.duration = reservation.duration as 'AM' | 'PM' | 'FULL';
       desk.bookingDate = reservation.bookingDate;
       
       // If this is the user's own reservation, mark it as such
       if (this.currentUser && reservation.userId === this.currentUser.id.toString()) {
         desk.isOwnReservation = true;
       }
     }
   });
 }

 public createPlan(): void {
   if (!this.authService.isAdmin()) {
     Swal.fire({
       title: 'Only Admins Can Create Plans',
       text: 'Please contact an admin to create a floor plan.',
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
       
       // Create a new plan if none exists - always with fixed dimensions and position
       const newPlan: ApiPlan = {
         name: 'New Floor Plan',
         width: 1135, // Fixed width
         height: 580, // Fixed height
         left: 10, // Fixed position
         top: 10   // Fixed position
       };
       
       this.isLoading = true;
       // Call the API to create the plan
       this.reservationService.createPlan(newPlan).subscribe({
         next: (createdPlan: ApiPlan) => {
           this.isLoading = false;
           const plan: Plan = {
             id: createdPlan.id?.toString() || `plan-${++this.planCounter}`,
             left: 10, // Always use fixed position
             top: 10,  // Always use fixed position
             width: 1135, // Fixed width
             height: 580, // Fixed height
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
   
   // Only admins can confirm the design and save changes
   if (!this.authService.isAdmin()) {
     Swal.fire({
       title: 'Only Admins Can Save Changes',
       text: 'Please contact an admin to save floor plan changes.',
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
 
   // Check for overlap with existing desks before creating
   if (this.checkDeskOverlap(plan, newX, newY)) {
     // Show alert that desk can't be added due to overlap and instruct to remove existing desk first
     Swal.fire({
       title: 'Cannot Add Desk',
       text: 'Cannot add a desk on top of another desk. If you want to add a desk here, remove the existing desk first.',
       icon: 'warning',
       confirmButtonText: 'OK'
     });
     return;
   }
 
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
   if (!this.currentPlan || !this.authService.isAdmin()) {
     Swal.fire({
       title: 'Only Admins Can Delete Plans',
       text: 'Please contact an admin to delete this floor plan.',
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

 // Store reservations for the selected desk (for booking dialog)
 // This is now defined as public above
 
 // Update the booking week dates for the calendar view
 private updateBookingWeekDates(): void {
   this.bookingWeekDates = [];
   
   // If in day view, only add the current date
   if (this.viewMode === 'day') {
     // Only add the current date being viewed
     this.bookingWeekDates.push(this.currentDate);
     console.log('Day view - only showing current date for booking:', this.currentDate);
     return;
   }
   
   // Week view logic - show multiple days
   // Start from today
   const today = new Date();
   let daysAdded = 0;
   let currentDate = new Date(today);
   
   // Maximum dates to look ahead to avoid infinite loop
   const maxDaysToCheck = 20; // Two weeks + some buffer for weekends
   let daysChecked = 0;
   
   while (daysAdded < 10 && daysChecked < maxDaysToCheck) {
     // Skip weekends
     if (!this.isWeekend(currentDate)) {
       const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
       this.bookingWeekDates.push(dateStr);
       daysAdded++;
     }
     
     // Move to next day
     currentDate.setDate(currentDate.getDate() + 1);
     daysChecked++;
   }
   
   console.log('Week view - showing multiple dates for booking:', this.bookingWeekDates);
 }
 
 public selectDesk(desk: Desk, event: MouseEvent): void {
   if (this.isPlanConfirmed) {
     // Check if this is a right-click (context menu) - works for all browsers
     const isRightClick = event.button === 2 || (event as any).which === 3;
     
     // Set loading state immediately
     this.isLoading = true;
     
     // Prevent context menu from appearing for right clicks
     if (isRightClick) {
       event.preventDefault();
       event.stopPropagation();
       console.log('Right click detected on desk:', desk.id);
     }
     
     // Helper function to show booking dialog
     const showBookingDialog = () => {
       this.hideTooltip();
       // Set up booking dialog data
       this.selectedDeskForBooking = desk;
       this.selectedBookingDates.clear();
       this.updateBookingWeekDates();
       this.bookingDuration = 'AM'; // Default to AM
       
       // In day view, automatically select ONLY the current date being viewed
       if (this.viewMode === 'day' && this.bookingWeekDates.length > 0) {
         // In day view, the booking week dates should contain only the current date
         // We'll check if it's already reserved by someone else
         if (!this.isDeskReservedOnDate(this.currentDate) || this.isCurrentUserReservation(this.currentDate)) {
           this.selectedBookingDates.add(this.currentDate);
           console.log('Auto-selected current date in day view:', this.currentDate);
         } else {
           console.log('Current date is reserved by someone else, cannot select:', this.currentDate);
         }
       } else if (this.viewMode === 'week') {
         // In week view, automatically select days that are already reserved by the current user
         for (const date of this.bookingWeekDates) {
           // If this date is reserved by the current user, pre-select it
           if (this.isCurrentUserReservation(date)) {
             this.selectedBookingDates.add(date);
             console.log('Pre-selected user reservation in week view:', date);
           }
         }
       }
               // Load reservations first, then show dialog when data is ready
       this.loadDeskReservationsForBookingDates(desk.id, () => {
         // Now that reservations are loaded, we can accurately preselect user's reservations
         // Clear tracking sets for updating reservations
         this.initialUserReservations.clear();
         this.userReservationIds.clear();
         
         // Store current selections before clearing
         const dayViewSelections = this.viewMode === 'day' ? new Set(this.selectedBookingDates) : new Set<string>();
         this.selectedBookingDates.clear();
         
         // Track user reservations for both day and week view
         for (const date of this.bookingWeekDates) {
           // First check if date is reserved by another user and ensure it can't be selected
           const isReservedByOthers = this.isDeskReservedOnDate(date) && !this.isCurrentUserReservation(date);
           
           if (isReservedByOthers) {
             // This date is reserved by another user, so we must ensure it's not selected
             if (this.selectedBookingDates.has(date)) {
               this.selectedBookingDates.delete(date);
               console.log(`Removing date ${date} from selection - it's reserved by another user`);
             }
             // Now skip to the next date
             continue;
           }
           
           // Handle user's own reservations
           if (this.isCurrentUserReservation(date)) {
             // Track all user reservations for update/delete operations
             this.initialUserReservations.add(date);
             
             // For week view, preselect these dates
             if (this.viewMode === 'week') {
               this.selectedBookingDates.add(date);
               console.log(`Pre-selected user reservation in week view: ${date}`);
             }
             
             // Find reservation ID for this date to enable deletion
             const reservation = this.selectedDeskReservations.find(res => 
               res.bookingDate === date && 
               res.deskId === this.selectedDeskForBooking!.id
             );
             
             if (reservation && reservation.id) {
               this.userReservationIds.set(date, reservation.id);
               console.log(`Tracking user reservation ID ${reservation.id} for date ${date}`);
               
               // Set the booking duration to match the existing reservation's duration
               // This will show the correct value in the dropdown when editing a reservation
               if (reservation.duration) {
                 // Ensure the duration is either 'AM' or 'PM' or 'FULL' to match the type constraint
                 this.bookingDuration = reservation.duration === 'PM' ? 'PM' : reservation.duration === 'FULL' ? 'FULL' : 'AM';
                 console.log(`Setting booking duration to match existing reservation: ${this.bookingDuration}`);
               }
             }
             
             console.log('Found user reservation:', date);
           }
         }
         
         // For day view, restore the previously selected date(s)
         if (this.viewMode === 'day') {
           // If we had selections, restore them
           if (dayViewSelections.size > 0) {
             for (const date of dayViewSelections) {
               this.selectedBookingDates.add(date);
               console.log('Restored day view selection:', date);
             }
           } else {
             // If no selections, try to select the current date or first available
             const today = new Date();
             const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
             
             if (this.bookingWeekDates.includes(todayString) && 
                 (!this.isDeskReservedOnDate(todayString) || this.isCurrentUserReservation(todayString))) {
               this.selectedBookingDates.add(todayString);
               console.log('Auto-selected today for day view:', todayString);
             } else {
               // Otherwise select first available date
               for (const date of this.bookingWeekDates) {
                 if (!this.isDeskReservedOnDate(date) || this.isCurrentUserReservation(date)) {
                   this.selectedBookingDates.add(date);
                   console.log('Auto-selected first available date for day view:', date);
                   break;
                 }
               }
             }
           }
         }
         
         // Show dialog after data is loaded
         this.showBookingDialog = true;
         console.log('Opening booking dialog for desk:', desk.id, 'Current status:', desk.available ? 'Available' : 'Reserved');
       });
     };
     
     // Check if this desk is already reserved and belongs to the current user
     if (desk.available === false) {
       this.findUserReservationForDesk(desk).then(reservationId => {
         // Different behavior based on view mode
         if (this.viewMode === 'day') {
           // DAY VIEW - Allow cancellation of own reservations
           if (reservationId !== null) {
             // This is the user's own reservation
             this.isLoading = false;
             
             // Check if this is a right-click (context menu)
             const isRightClick = event.button === 2 || event.ctrlKey;
             
             if (isRightClick) {
               // Right-click shows confirmation before canceling
               this.isLoading = false;
               Swal.fire({
                 title: 'Cancel Reservation',
                 text: 'Are you sure you want to cancel your reservation for this desk?',
                 icon: 'warning',
                 showCancelButton: true,
                 confirmButtonText: 'Yes, cancel it',
                 cancelButtonText: 'No, keep it'
               }).then((result) => {
                 if (result.isConfirmed) {
                   this.isLoading = true;
                   this.reservationService.deleteReservation(reservationId).subscribe({
                     next: () => {
                       // Update the desk status in UI
                       desk.available = true;
                       desk.employeeName = undefined;
                       desk.duration = undefined;
                       desk.bookingDate = undefined;
                       
                       this.isLoading = false;
                       Swal.fire({
                         title: 'Reservation Cancelled',
                         text: 'Your reservation has been successfully cancelled.',
                         icon: 'success',
                         confirmButtonText: 'OK'
                       });
                       
                       // Refresh reservations view
                       this.loadReservationsForCurrentView();
                     },
                     error: (error) => {
                       this.isLoading = false;
                       Swal.fire({
                         title: 'Error',
                         text: `Failed to cancel reservation: ${error.message || 'Unknown error'}`,
                         icon: 'error',
                         confirmButtonText: 'OK'
                       });
                     }
                   });
                 }
               });
             } else {
               // Left-click shows booking dialog to update reservation
               // Also grab the duration from the existing reservation
               const existingReservation = this.selectedDeskReservations.find(res => 
                 res.id === reservationId
               );
               
               if (existingReservation && existingReservation.duration) {
                 // Save the duration before opening dialog - ensure it's either 'AM' or 'PM' or 'FULL'
                 this.bookingDuration = existingReservation.duration === 'PM' ? 'PM' : existingReservation.duration === 'FULL' ? 'FULL' : 'AM';
                 console.log(`Setting duration to existing value: ${this.bookingDuration}`);
               }
               
               showBookingDialog();
             }
           } else {
             // In day view, desk reserved by someone else - just show an alert
             this.isLoading = false;
             Swal.fire({
               title: 'Desk Reserved',
               text: 'This desk is already reserved by another user.',
               icon: 'info',
               confirmButtonText: 'OK'
             });
             return;
           }
         } else {
           // WEEK VIEW - Always show booking dialog
           showBookingDialog();
           return;
         }
       });
     } else {
       // Desk is available, show booking dialog
       showBookingDialog();
     }
   } else {
     event.stopPropagation();
     this.clearSelections();
     this.selectedDesk = desk;
     // Focus the container to ensure keyboard events work properly
     if (this.designContainer) {
       this.designContainer.nativeElement.focus();
     }
   }
 }
 
 // Load all reservations for the displayed booking dates to check for conflicts
 private loadDeskReservationsForBookingDates(deskId: number, callback?: () => void): void {
   // Make sure booking week dates are populated
   if (this.bookingWeekDates.length === 0) {
     this.updateBookingWeekDates(); // Ensure we have dates to check
     if (this.bookingWeekDates.length === 0) {
       this.isLoading = false;
       if (callback) callback();
       return;
     }
   }
   
   // Reset previous reservation data
   this.deskReservationDates.clear();
   this.selectedDeskReservations = [];
   
   // Get start and end dates from booking week dates
   const startDate = this.bookingWeekDates[0];
   const endDate = this.bookingWeekDates[this.bookingWeekDates.length - 1];
   
   console.log(`Checking desk ${deskId} reservations from ${startDate} to ${endDate}`);
   console.log('Booking dates to check:', this.bookingWeekDates);
   
   // Check if user is admin (has more permissions)
   const isAdmin = this.authService.isAdmin();
   console.log(`User is admin: ${isAdmin}`);
   
   // For regular users, we need a different approach since they don't have access to getAllReservations
   if (!isAdmin) {
     console.log('Regular user detected, using alternative reservation loading approach');
     this.loadReservationsForRegularUser(deskId, startDate, endDate, callback);
     return;
   }
   
   // For admins, we can use the original approach
   this.reservationService.getAllReservationsInDateRange(startDate, endDate).subscribe({
     next: (reservations: Reservation[]) => {
       console.log(`Received ${reservations.length} total reservations in date range`);
       
       // Filter for this specific desk
       const deskReservations = reservations.filter(res => res.deskId === deskId);
       console.log(`Found ${deskReservations.length} reservations for desk ${deskId}`);
       
       // Store the filtered reservations
       this.selectedDeskReservations = deskReservations;
       
       // Mark each date as reserved
       for (const reservation of deskReservations) {
         this.deskReservationDates.add(reservation.bookingDate);
         
         // Track reservation IDs for dates to enable proper updating
         if (this.isCurrentUserReservation(reservation.bookingDate) && reservation.id !== undefined) {
           this.userReservationIds.set(reservation.bookingDate, reservation.id);
         }
         
         console.log(`\u2713 Desk ${deskId} is reserved on ${reservation.bookingDate}`);
       }
       
       // Show confirmation of found dates
       if (this.deskReservationDates.size > 0) {
         console.log(`Desk ${deskId} is reserved on these dates:`, [...this.deskReservationDates]);
       } else {
         console.log(`Desk ${deskId} has no reservations in the selected date range`);
       }
       
       this.isLoading = false;
       if (callback) callback();
     },
     error: (error: any) => {
       console.error(`Failed to load all reservations in date range`, error);
       
       // Fallback to checking each date individually
       this.checkIndividualDates(deskId, callback);
     }
   });
 }
 
 // Fallback method to check each date individually if the date range API fails
 // Special method for regular users to load reservations information
 private loadReservationsForRegularUser(deskId: number, startDate: string, endDate: string, callback?: () => void): void {
   console.log('Loading reservations for regular user (non-admin)');
   
   // We need to combine two methods for regular users to get the full picture:
   // 1. getUserReservationsInDateRange - to get the user's own reservations
   // 2. getReservationsByDate for each date - to see which dates are reserved by others
   
   // First, get the user's own reservations
   this.reservationService.getUserReservationsInDateRange(startDate, endDate).subscribe({
     next: (userReservations: Reservation[]) => {
       console.log(`Got ${userReservations.length} reservations for current user in date range`);
       
       // Filter to just this desk
       const userDeskReservations = userReservations.filter(res => res.deskId === deskId);
       console.log(`Found ${userDeskReservations.length} user's reservations for desk ${deskId}`);
       
       // Store these reservations
       this.selectedDeskReservations = userDeskReservations;
       
       // Mark the user's reserved dates and track them for updates
       for (const reservation of userDeskReservations) {
         this.deskReservationDates.add(reservation.bookingDate);
         
         // Track for updates
         if (reservation.id !== undefined) {
           this.userReservationIds.set(reservation.bookingDate, reservation.id);
           this.initialUserReservations.add(reservation.bookingDate);
         }
         
         console.log(`User has reserved desk ${deskId} on ${reservation.bookingDate}`);
       }
       
       // Now check all dates to see which are reserved by others
       this.checkAllDatesForReservations(deskId, callback);
     },
     error: (error) => {
       console.error('Failed to get user reservations:', error);
       
       // Still proceed with checking all dates
       this.checkAllDatesForReservations(deskId, callback);
     }
   });
 }
 
 // Check all dates to find reservations by any user (for regular users)
 private checkAllDatesForReservations(deskId: number, callback?: () => void): void {
   // Counter to track completed requests
   let completedRequests = 0;
   const totalRequests = this.bookingWeekDates.length;
   
   // For each date, check all reservations
   this.bookingWeekDates.forEach(date => {
     // Use getReservationsByDate which is accessible to all users
     this.reservationService.getReservationsByDate(date).subscribe({
       next: (reservations: Reservation[]) => {
         // Find reservations for this desk on this date
         const deskReservations = reservations.filter(res => res.deskId === deskId);
         
         if (deskReservations.length > 0) {
           // This desk is reserved on this date
           this.deskReservationDates.add(date);
           
           // Add these reservations to our collection if not already there
           for (const reservation of deskReservations) {
             if (!this.selectedDeskReservations.some(r => r.id === reservation.id)) {
               this.selectedDeskReservations.push(reservation);
             }
           }
           
           console.log(`Desk ${deskId} is reserved on ${date} (${deskReservations.length} reservation(s))`);
         }
         
         // Count this request as completed
         completedRequests++;
         
         // If all requests are done, finish loading
         if (completedRequests === totalRequests) {
           console.log(`Found ${this.deskReservationDates.size} dates when desk ${deskId} is reserved`);
           console.log(`Total reservations loaded: ${this.selectedDeskReservations.length}`);
           this.isLoading = false;
           if (callback) callback();
         }
       },
       error: (error: any) => {
         console.error(`Failed to load reservations for date ${date}`, error);
         completedRequests++;
         
         // If all requests are done, finish loading
         if (completedRequests === totalRequests) {
           this.isLoading = false;
           if (callback) callback();
         }
       }
     });
   });
 }
 
 private checkIndividualDates(deskId: number, callback?: () => void): void {
   // Counter to track completed requests
   let completedRequests = 0;
   const totalRequests = this.bookingWeekDates.length;
   
   // For each date, check reservations using the API endpoint we know exists
   this.bookingWeekDates.forEach(date => {
     // Use getReservationsByDate which is a confirmed working endpoint
     this.reservationService.getReservationsByDate(date).subscribe({
       next: (reservations: Reservation[]) => {
         // For each reservation on this date
         for (const reservation of reservations) {
           // If this reservation is for the desk we're looking at
           if (reservation.deskId === deskId) {
             // This desk is reserved on this date
             this.deskReservationDates.add(date);
             console.log(`Desk ${deskId} is reserved on ${date}`);
             break; // No need to check more reservations for this date
           }
         }
         
         // Count this request as completed
         completedRequests++;
         
         // If all requests are done, finish loading
         if (completedRequests === totalRequests) {
           console.log(`Found ${this.deskReservationDates.size} dates when desk ${deskId} is reserved`);
           this.isLoading = false;
           if (callback) callback();
         }
       },
       error: (error: any) => {
         console.error(`Failed to load reservations for date ${date}`, error);
         completedRequests++;
         
         // If all requests are done, finish loading
         if (completedRequests === totalRequests) {
           this.isLoading = false;
           if (callback) callback();
         }
       }
     });
   });
 }
 
 // Check if the selected desk is already reserved on a specific date by ANY user (including others)
 public isDeskReservedOnDate(date: string): boolean {
   // Extra debug info for reservation checking
   const isReserved = this.deskReservationDates.has(date);
   console.log(`Checking if desk ${this.selectedDeskForBooking?.id} is reserved on date ${date}: ${isReserved}`);
   console.log('All reserved dates:', Array.from(this.deskReservationDates));
   
   // Check if the date exists in our set of reserved dates for this desk
   return isReserved;
 }
 
 
 // Check if the selected desk reservation on a specific date belongs to the current user
 public isCurrentUserReservation(date: string): boolean {
   // Check if there's a reservation for this desk on this date
   if (!this.deskReservationDates.has(date)) {
     console.log(`Date ${date} is not in the reserved dates set`);
     return false;
   }
   
   if (!this.selectedDeskForBooking) {
     console.log(`No desk is selected for booking`);
     return false;
   }
   
   // Find the reservation for this desk and date
   const reservation = this.selectedDeskReservations.find(res => 
     res.bookingDate === date && 
     res.deskId === this.selectedDeskForBooking!.id
   );
   
   if (!reservation) {
     console.log(`No reservation found for desk ${this.selectedDeskForBooking.id} on date ${date}`);
     return false;
   }
   
   // Check if it belongs to the current user
   if (!this.currentUser) {
     console.log('No current user found');
     return false;
   }
   
   // Try multiple approaches to compare user IDs
   const reservationUserIdStr = String(reservation.userId || '').trim();
   const currentUserIdStr = String(this.currentUser.id || '').trim();
   
   // Check by employee name as a fallback
   const currentUserEmail = this.currentUser.email;
   const currentUserFullName = `${this.currentUser.firstName} ${this.currentUser.lastName}`.trim();
   const reservationName = reservation.employeeName;
   
   // Add extra debugging for user identification issues
   console.log(`Checking reservation ownership: Desk ${this.selectedDeskForBooking.id}, Date ${date}`);
   console.log(`Reservation user: ID=${reservationUserIdStr}, Name=${reservationName}`);
   console.log(`Current user: ID=${currentUserIdStr}, Name=${currentUserFullName}, Email=${currentUserEmail}`);
   
   // Try multiple matching approaches
   // 1. Direct ID comparison
   let isMatch = reservationUserIdStr === currentUserIdStr;
   
   // 2. Name comparison (if #1 fails)
   if (!isMatch && reservationName && currentUserFullName) {
     isMatch = reservationName.toLowerCase().includes(currentUserFullName.toLowerCase());
   }
   
   // 3. Email comparison (if #1 and #2 fail)
   if (!isMatch && reservationName && currentUserEmail) {
     isMatch = reservationName.toLowerCase().includes(currentUserEmail.toLowerCase());
   }
   
   console.log(`Reservation match result: ${isMatch}`);
   return isMatch;
 }
 
 // Find a reservation ID for the current user's booking on a specific desk
 public findUserReservationForDesk(desk: Desk): Promise<number | null> {
   return new Promise((resolve) => {
     // First check if desk is actually reserved
     if (desk.available === true) {
       resolve(null);
       return;
     }
     
     this.reservationService.getUserReservations().subscribe({
       next: (reservations) => {
         // Find reservation for this desk that belongs to the current user
         // In day view, we need to match both desk ID and date
         let reservation;
         
         if (this.viewMode === 'day' && desk.bookingDate) {
           // For day view, check both desk ID and booking date
           reservation = reservations.find(r => 
             r.deskId === desk.id && 
             r.bookingDate === desk.bookingDate
           );
           console.log(`Day view: Checking for reservation with desk ${desk.id} on date ${desk.bookingDate}`);
         } else {
           // For week view or if no booking date, just check desk ID
           reservation = reservations.find(r => r.deskId === desk.id);
           console.log(`Week view or no date: Checking for reservation with desk ${desk.id}`);
         }
         
         if (reservation && reservation.id) {
           console.log(`Found user's reservation for desk ${desk.id}, id: ${reservation.id}`);
           resolve(reservation.id);
         } else {
           console.log(`No reservation found for desk ${desk.id} belonging to current user`);
           resolve(null);
         }
       },
       error: (error) => {
         console.error('Error fetching user reservations:', error);
         resolve(null);
       }
     });
   });
 }

 public rotateDesk(desk: Desk): void {
   if (this.isPlanConfirmed) return;
   desk.rotation = (desk.rotation + 90) % 360;
 }

 public removeDesk(desk: Desk, event: MouseEvent): void {
   if (this.isPlanConfirmed) return;
   
   // Stop propagation to prevent plan selection
   event.stopPropagation();
   
   // Check if admin - only admins can modify plans
   if (!this.authService.isAdmin()) {
     Swal.fire({
       title: 'Only Admins Can Remove Desks',
       text: 'Please contact an admin to remove this desk.',
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
   // Focus the container to ensure keyboard events work properly
   if (this.designContainer) {
     this.designContainer.nativeElement.focus();
   }
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
   if (!this.designContainer) return;
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
 @HostListener('window:zoom')
 @HostListener('window:scroll')
 onWindowResize(): void {
   // Call our updateContainerWidths method which now handles responsive sizing
   this.syncContainerWidths();
   this.updateContainerWidths();
   
   // Scale plan to fit container if needed
   this.adjustPlanToFitContainer();
   
   // Handle zoom level changes
   this.handleZoomChange();
 }
 
 // Handle browser zoom level changes
 private handleZoomChange(): void {
   if (!this.currentPlan || !this.designContainer) return;
   
   // For consistent design container, we're using fixed dimensions
   // No dynamic scaling needed for zoom changes since container size is fixed
   
   // However, we'll ensure the plan is properly positioned within the container
   const container = this.designContainer.nativeElement;
   const planElements = container.querySelectorAll('.plan');
   
   Array.from(planElements).forEach((element) => {
     const planElement = element as HTMLElement;
     
     // Ensure the plan is centered within the design container
     planElement.style.left = '10px';
     planElement.style.top = '10px';
     
     // Remove any transforms that might have been applied previously
     planElement.style.transform = '';
   });
 }
 
 // Maintain fixed plan size relative to container
 private adjustPlanToFitContainer(): void {
   if (!this.currentPlan || !this.designContainer) return;
   
   // For a consistent design container, we maintain fixed dimensions
   // and ensure the plan is properly positioned
   const planElements = this.designContainer.nativeElement.querySelectorAll('.plan');
   
   // Reset any styles that might affect the fixed size
   Array.from(planElements).forEach((element) => {
     const planElement = element as HTMLElement;
     
     // Reset positions to their intended fixed values
     planElement.style.left = '10px';
     planElement.style.top = '10px';
     planElement.style.maxWidth = '';
     planElement.style.maxHeight = '';
     planElement.style.transform = '';
     
     // Ensure the plan has fixed dimensions matching the container
     planElement.style.width = `${this.currentPlan!.width}px`;
     planElement.style.height = `${this.currentPlan!.height}px`;
   });
 }

 public onPlanContextMenu(event: MouseEvent, plan: Plan): void {
   event.preventDefault();
   this.selectPlan(plan, event);
 }

 public startPlanDragging(event: MouseEvent, plan: Plan): void {
   // Disable plan dragging to maintain fixed position
   event.preventDefault();
   event.stopPropagation();
   
   // Show message to inform user that plan position is fixed
   console.log('Plan position is fixed at left=10, top=10');
 }

 public startPlanResizing(event: MouseEvent, plan: Plan, handle: string): void {
   // Disable plan resizing to maintain fixed dimensions
   event.preventDefault();
   event.stopPropagation();
   
   // Show message to inform user that plan dimensions are fixed
   console.log('Plan dimensions are fixed at 1065x570');
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
     // Prevent default browser context menu
     event.preventDefault();
     
     // In booking mode, first check if this is a desk reserved by the current user
     if (desk.available === false) {
       // Check if this desk is reserved by the current user
       this.findUserReservationForDesk(desk).then(reservationId => {
         if (reservationId !== null) {
           // This is the user's own reservation - offer to cancel
           Swal.fire({
             title: 'Your Reservation',
             text: `You have reserved this desk. Would you like to cancel your reservation?`,
             icon: 'question',
             showCancelButton: true,
             confirmButtonText: 'Yes, cancel reservation',
             cancelButtonText: 'No, keep it'
           }).then((result) => {
             if (result.isConfirmed) {
               this.isLoading = true;
               // Delete the reservation
               this.reservationService.deleteReservation(reservationId).subscribe({
                 next: () => {
                   // Update the desk status in UI
                   desk.available = true;
                   desk.employeeName = undefined;
                   desk.duration = undefined;
                   desk.bookingDate = undefined;
                   
                   this.isLoading = false;
                   Swal.fire({
                     title: 'Reservation Cancelled',
                     text: 'Your reservation has been successfully cancelled.',
                     icon: 'success',
                     confirmButtonText: 'OK'
                   });
                   
                   // Refresh reservations view
                   this.loadReservationsForCurrentView();
                 },
                 error: (error) => {
                   this.isLoading = false;
                   Swal.fire({
                     title: 'Error',
                     text: `Failed to cancel reservation: ${error.message || 'Unknown error'}`,
                     icon: 'error',
                     confirmButtonText: 'OK'
                   });
                 }
               });
             }
           });
         } else {
           // This desk is reserved by someone else - show the booking dialog
           this.selectedDeskForBooking = desk;
           this.showBookingDialog = true;
           this.updateBookingWeekDates();
           
           // If desk is already reserved, show details
           if (desk.available === false && desk.employeeName) {
             this.employeeName = desk.employeeName;
           } else {
             // For new reservations, we don't need to set employeeName
             this.employeeName = '';
           }
         }
       });
     } else {
       // Desk is available - show booking dialog
       this.selectedDeskForBooking = desk;
       this.showBookingDialog = true;
       this.updateBookingWeekDates();
       this.employeeName = '';
     }
   } else {
     // In design mode, context menu is for removing desks
     // Use SweetAlert instead of basic confirm dialog
     Swal.fire({
       title: 'Remove Desk',
       text: 'Do you want to remove this desk?',
       icon: 'question',
       showCancelButton: true,
       confirmButtonText: 'Yes, remove it',
       cancelButtonText: 'Cancel'
     }).then((result) => {
       if (result.isConfirmed) {
         // Remove the desk from the current plan
         if (this.currentPlan) {
           this.currentPlan.desks = this.currentPlan.desks.filter(d => d !== desk);
           
           // Clear selection if the removed desk was selected
           if (this.selectedDesk === desk) {
             this.selectedDesk = null;
           }
         }
       }
     });
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
   
   if (this.designContainer) {
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
 }

 private hideSnapGuides(): void {
   if (this.designContainer) {
     const container = this.designContainer.nativeElement;
     const guides = container.querySelectorAll('.snap-guide');
     guides.forEach(guide => guide.remove());
   }
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
   
   // Check if admin - only admins can modify plans
   if (!this.authService.isAdmin()) {
     Swal.fire({
       title: 'Only Admins Can Modify Walls',
       text: 'Please contact an admin to modify walls.',
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
   
   // Validate that in day view, only the current date can be booked
   if (this.viewMode === 'day') {
     const nonCurrentDates = Array.from(this.selectedBookingDates).filter(date => date !== this.currentDate);
     if (nonCurrentDates.length > 0) {
       console.error('Invalid selections in day view:', nonCurrentDates);
       Swal.fire({
         title: 'Error',
         text: 'In day view, you can only book the current date being viewed.',
         icon: 'error',
         confirmButtonText: 'OK'
       });
       this.isLoading = false;
       return;
     }
   }
   
   // Get all the selected dates
   const dates = Array.from(this.selectedBookingDates);
   
   // Special case: If we had initial reservations but now all dates are deselected,
   // we will interpret this as the user wanting to cancel all their reservations for this desk
   if (dates.length === 0 && this.initialUserReservations.size > 0) {
     // Ask for confirmation before removing all reservations
     Swal.fire({
       title: 'Cancel All Reservations?',
       text: 'Are you sure you want to cancel all your reservations for this desk?',
       icon: 'warning',
       showCancelButton: true,
       confirmButtonText: 'Yes, cancel all',
       cancelButtonText: 'No, keep them'
     }).then((result) => {
       if (result.isConfirmed) {
         // Process all dates for deletion
         this.deleteAllReservationsForDesk();
       } else {
         this.isLoading = false;
       }
     });
     return;
   }
   
   // Regular error case - they haven't selected any dates and don't have existing reservations
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
   
   // Find new dates to create (selected dates that weren't initially selected)
   this.datesToCreate = dates.filter(date => !this.initialUserReservations.has(date));
   
   // Find dates to delete (initially selected dates that are now deselected)
   this.datesToDelete = Array.from(this.initialUserReservations).filter(date => 
     !this.selectedBookingDates.has(date)
   );
   
   // Find unchanged dates (already reserved by the user and still selected)
   const unchangedDates = dates.filter(date => this.initialUserReservations.has(date));
   
   console.log('Initial user reservations:', Array.from(this.initialUserReservations));
   console.log('Currently selected dates:', dates);
   console.log('New dates to create:', this.datesToCreate);
   console.log('Dates to delete:', this.datesToDelete);
   console.log('Unchanged dates:', unchangedDates);
   console.log('New booking duration:', this.bookingDuration);
   
   // Check if only the duration has changed for existing reservations (in day view especially)
   const reservationsToUpdateDuration: {id: number, date: string}[] = [];
   
   // Check for duration changes on existing reservations
   if (this.viewMode === 'day' && unchangedDates.length > 0) {
     unchangedDates.forEach(date => {
       // Find the existing reservation for this date
       const existingReservation = this.selectedDeskReservations.find(res => 
         res.bookingDate === date && 
         res.deskId === this.selectedDeskForBooking!.id
       );
       
       // If reservation exists and duration has changed, add to update list
       if (existingReservation && 
           existingReservation.id && 
           existingReservation.duration !== this.bookingDuration) {
         
         console.log(`Will update duration for reservation ${existingReservation.id} from ${existingReservation.duration} to ${this.bookingDuration}`);
         
         reservationsToUpdateDuration.push({
           id: existingReservation.id,
           date: date
         });
       }
     });
   }
   
   const durationChanged = reservationsToUpdateDuration.length > 0;
   console.log('Duration changed:', durationChanged, 'Count:', reservationsToUpdateDuration.length);
   
   // Skip processing if nothing has changed after checking duration changes
   if (this.datesToCreate.length === 0 && this.datesToDelete.length === 0 && !durationChanged) {
     console.log('No changes detected, skipping update');
     Swal.fire({
       title: 'No Changes',
       text: 'No changes were made to your reservations.',
       icon: 'info',
       confirmButtonText: 'OK'
     });
     this.isLoading = false;
     this.closeBookingDialog();
     return;
   }
   
   // Calculate total operations (all changes count as operations)
   let totalOperations = this.datesToCreate.length + this.datesToDelete.length + reservationsToUpdateDuration.length;
   let completedBookings = 0;
   let failedBookings = 0;
   
   // If there are no operations, we're already done
   if (totalOperations === 0) {
     // Just close the dialog, nothing to do
     this.isLoading = false;
     this.closeBookingDialog();
     return;
   }
   
   // Process duration updates first - use the standard update method
   if (reservationsToUpdateDuration.length > 0) {
     reservationsToUpdateDuration.forEach(reservation => {
       // Find the full reservation object
       const existingReservation = this.selectedDeskReservations.find(res => 
         res.id === reservation.id && res.bookingDate === reservation.date
       );
       
       if (existingReservation) {
         // Create updated reservation with the new duration
         const updatedReservation: Reservation = {
           ...existingReservation,
           duration: this.bookingDuration
         };
         
         // Log the reservation details for debugging
         console.log('Updating reservation with details:', {
           id: reservation.id,
           date: reservation.date,
           newDuration: this.bookingDuration,
           oldDuration: existingReservation.duration
         });
         
         // Use the standard update method which is already implemented in the backend
         this.reservationService.updateReservation(reservation.id, updatedReservation).subscribe({
           next: (updatedReservation) => {
             console.log(`Successfully updated duration for reservation on ${reservation.date} to ${this.bookingDuration}`);
             completedBookings++;
             this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
           },
           error: (error) => {
             console.error(`Failed to update duration for reservation on ${reservation.date}`, error);
             failedBookings++;
             this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
           }
         });
       } else {
         console.error(`Could not find full reservation details for ID ${reservation.id}`);
         failedBookings++;
         this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
       }
     });
   }
   
   // Process deletions first
   if (this.datesToDelete.length > 0) {
     this.datesToDelete.forEach(date => {
       const reservationId = this.userReservationIds.get(date);
       if (reservationId) {
         console.log(`Deleting reservation for ${date} (ID: ${reservationId})`);
         
         this.reservationService.deleteReservation(reservationId).subscribe({
           next: () => {
             console.log(`Successfully deleted reservation for ${date}`);
             completedBookings++;
             this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
           },
           error: (error) => {
             console.error(`Failed to delete reservation for ${date}`, error);
             failedBookings++;
             this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
           }
         });
       } else {
         console.error(`Could not find reservation ID for date ${date}`);
         failedBookings++;
         this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
       }
     });
   }
   
   // Process new date creations
   this.datesToCreate.forEach(date => {
     // Create reservation object to send to backend
     // The backend will automatically use the current user's information
     const reservation: Reservation = {
       deskId: this.selectedDeskForBooking!.id,
       bookingDate: date,
       duration: this.bookingDuration
     };
     
     console.log(`Creating new reservation for ${date}`);
     this.reservationService.createReservation(reservation).subscribe({
       next: (response) => {
         completedBookings++;
         console.log(`Created reservation for date ${date}`, response);
         
         // Check if all bookings are processed
         this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
       },
       error: (error: any) => {
         failedBookings++;
         console.error(`Failed to create reservation for date ${date}`, error);
         
         // Check if all operations are processed (add this check before showing error messages)
         this.checkBookingCompletion(completedBookings, failedBookings, totalOperations);
         
         // Check for specific error conditions
         if (error.status === 409 || 
             (error.error && error.error.message && error.error.message.includes('one desk reservation is allowed per day'))) {
           Swal.fire({
             title: 'Reservation Failed',
             text: `Could not book desk for ${this.formatDate(date)}: You already have a desk reservation for this date. Only one desk reservation is allowed per day.`,
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
         // Pass the total number of operations (selected dates + deleted dates)
         this.checkBookingCompletion(completedBookings, failedBookings, this.selectedBookingDates.size);
       }
     });
   });
 }
 
 private checkBookingCompletion(completed: number, failed: number, total: number): void {
   // Only proceed if all operations have been processed (new bookings + deletions)
   if (completed + failed === total) {
     this.isLoading = false;
     
     if (total === 0) {
       // No operations were needed
       this.closeBookingDialog();
     } else if (failed === 0) {
       // All operations succeeded
       Swal.fire({
         title: 'Success',
         text: this.datesToCreate.length > 0 && this.datesToDelete.length === 0 ?
               'Your new reservations have been confirmed!' :
               'Your reservations have been updated!',
         icon: 'success',
         confirmButtonText: 'OK'
       }).then(() => {
         // Reload the page to show updated reservations
         window.location.reload();
       });
       this.closeBookingDialog();
     } else if (completed > 0) {
       // Some operations succeeded
       Swal.fire({
         title: 'Update Completed',
         text: `Your reservation has been updated successfully.`,
         icon: 'success',
         confirmButtonText: 'OK'
       }).then(() => {
         // Reload the page to show updated reservations
         window.location.reload();
       });
       this.closeBookingDialog();
     } else {
       // All operations failed
       Swal.fire({
         title: 'Reservation Limit Reached',
         text: 'You can only reserve one desk per day. Please cancel your existing reservation before booking a different desk for the same day.',
         icon: 'warning',
         confirmButtonText: 'OK'
       });
     }
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
             this.bookingDuration = 'AM';
             
             // IMPORTANT: Clear localStorage reservation entry
             // This prevents the cancelled reservation from appearing on the home page
             if (this.currentUser && this.currentUser.id) {
               const storageKey = `desk_reservation_user_${this.currentUser.id}`;
               localStorage.removeItem(storageKey);
               console.log(`Cleared desk reservation from localStorage for user ${this.currentUser.id}`);
             }
             
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
   this.bookingDuration = 'AM';
   this.selectedBookingDates.clear();
 }
 
 /**
  * Deselect all dates in the booking dialog
  * This allows users to quickly clear all selections
  */
 public deselectAllDates(): void {
   this.selectedBookingDates.clear();
   console.log('All dates deselected');
   // Alert removed as requested
 }
 
 /**
  * Delete all reservations for the currently selected desk
  * Used when user deselects all dates and confirms
  */
 private deleteAllReservationsForDesk(): void {
   const totalToDelete = this.initialUserReservations.size;
   let completed = 0;
   let failed = 0;
   
   // If no reservations to delete, we're done
   if (totalToDelete === 0) {
     this.isLoading = false;
     return;
   }
   
   console.log(`Deleting all ${totalToDelete} reservations for desk ${this.selectedDeskForBooking?.id}`);
   
   // Process each reservation for deletion
   this.initialUserReservations.forEach(date => {
     const reservationId = this.userReservationIds.get(date);
     if (reservationId) {
       this.reservationService.deleteReservation(reservationId).subscribe({
         next: () => {
           console.log(`Successfully deleted reservation for ${date}`);
           completed++;
           
           // Check if we're done with all deletions
           if (completed + failed === totalToDelete) {
             this.finishAllDeletions(completed, totalToDelete);
           }
         },
         error: (error) => {
           console.error(`Failed to delete reservation for ${date}`, error);
           failed++;
           
           // Check if we're done with all deletions
           if (completed + failed === totalToDelete) {
             this.finishAllDeletions(completed, totalToDelete);
           }
         }
       });
     } else {
       console.error(`Could not find reservation ID for date ${date}`);
       failed++;
       
       // Check if we're done with all deletions
       if (completed + failed === totalToDelete) {
         this.finishAllDeletions(completed, totalToDelete);
       }
     }
   });
 }
 
 /**
  * Finish processing after all deletions are complete
  */
 private finishAllDeletions(completed: number, total: number): void {
   this.isLoading = false;
   
   if (completed === total) {
     // All were successfully deleted
     Swal.fire({
       title: 'Success',
       text: 'All your reservations for this desk have been cancelled',
       icon: 'success',
       confirmButtonText: 'OK'
     }).then(() => {
       // Reload the page to show updated reservations
       window.location.reload();
     });
   } else if (completed > 0) {
     // Some were deleted
     Swal.fire({
       title: 'Partial Success',
       text: `${completed} out of ${total} reservations were cancelled. Some cancellations failed.`,
       icon: 'info',
       confirmButtonText: 'OK'
     }).then(() => {
       // Reload the page to show updated reservations
       window.location.reload();
     });
   } else {
     // None were deleted
     Swal.fire({
       title: 'Error',
       text: 'Failed to cancel your reservations. Please try again later.',
       icon: 'error',
       confirmButtonText: 'OK'
     });
   }
   
   this.closeBookingDialog();
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
   // Don't allow selecting past dates
   if (this.isPastDate(date)) {
     console.log('Cannot select past date:', date);
     return;
   }
   
   // Don't allow selecting dates reserved by other users for any user role
   if (this.isDeskReservedOnDate(date) && !this.isCurrentUserReservation(date)) {
     console.log('Date is reserved by someone else, cannot select:', date);
     
     // Show a more user-friendly message
     Swal.fire({
       title: 'Date Reserved',
       text: 'This date is already reserved by another user.',
       icon: 'info',
       confirmButtonText: 'OK'
     });
     return;
   }
   
   // Extra debugging info
   console.log('Toggling date:', date);
   console.log('Is date reserved:', this.isDeskReservedOnDate(date));
   console.log('Is user reservation:', this.isCurrentUserReservation(date));
   console.log('Already selected:', this.selectedBookingDates.has(date));
   
   // Toggle the date selection
   if (this.selectedBookingDates.has(date)) {
     this.selectedBookingDates.delete(date);
     console.log('Removed date from selection:', date);
   } else {
     this.selectedBookingDates.add(date);
     console.log('Added date to selection:', date);
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
               desk.duration = reservation.duration as 'AM' | 'PM' | 'FULL';
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
   this.weekDates = [];
   
   // Always start with today's date
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   
   // Get exactly 10 business days (two weeks) starting from today
   let daysAdded = 0;
   let currentDate = new Date(today);
   
   // Maximum dates to look ahead to avoid infinite loop
   const maxDaysToCheck = 20; // Two weeks + some buffer for weekends
   let daysChecked = 0;
   
   while (daysAdded < 10 && daysChecked < maxDaysToCheck) {
     // Skip weekends
     if (!this.isWeekend(currentDate)) {
       const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
       this.weekDates.push(dateStr);
       daysAdded++;
     }
     
     // Move to next day
     currentDate.setDate(currentDate.getDate() + 1);
     daysChecked++;
   }
   
   // After updating week dates, fetch user's existing reservations for the date range
   if (this.weekDates.length > 0) {
     this.loadUserReservationsForDateRange(this.weekDates[0], this.weekDates[this.weekDates.length - 1]);
   }
 }
 
 // Store user's reservations for the current view
 private userReservations: Reservation[] = [];
 
 // Map to track which dates are reserved by anyone for the selected desk
 // This is now defined above
 
 // Load user's reservations for a date range (to highlight already reserved days)
 private loadUserReservationsForDateRange(startDate: string, endDate: string): void {
   this.userReservations = [];
   
   this.reservationService.getUserReservationsInDateRange(startDate, endDate).subscribe({
     next: (reservations) => {
       this.userReservations = reservations;
       console.log('User reservations loaded for date range:', reservations.length);
     },
     error: (error) => {
       console.error('Failed to load user reservations for date range', error);
     }
   });
 }
 
 // Check if the user has already reserved a specific date
 public isUserReservedDate(date: string): boolean {
   return this.userReservations.some(reservation => reservation.bookingDate === date);
 }

 public toggleViewMode(): void {
   this.viewMode = this.viewMode === 'day' ? 'week' : 'day';
   if (this.viewMode === 'week') {
     // Update to always show the next 10 business days starting from today
     this.updateWeekDates();
     
     // Get today's date in YYYY-MM-DD format
     const today = new Date();
     const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
     
     // Clear any previous selections
     this.selectedWeekDates.clear();
     
     // Set the current date to today if it's in the week dates
     if (this.weekDates.includes(todayStr)) {
       this.currentDate = todayStr;
       this.selectedWeekDates.add(todayStr);
     } else {
       // If today is not in the week (rare case, could be all weekend days ahead), 
       // select the first available day
       this.currentDate = this.weekDates[0];
       this.selectedWeekDates.add(this.weekDates[0]);
     }
     
     // Update the desk statuses for the new selection
     this.updateDeskStatuses();
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
   const isReserved = reservations.some((r: Reservation) => r.deskId === desk.id);
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
   const reservation = reservations.find((r: Reservation) => r.deskId === desk.id);
   
   if (reservation) {
     const duration = reservation.duration === 'PM' ? 'Afternoon' : reservation.duration === 'FULL' ? 'Full day' : 'Morning';
     return `${reservation.employeeName || ''}, ${duration} on ${this.formatDate(date)}`;
   }
   
   return `${this.formatDate(date)}`;
 }

 public isSelectedBookingDate(date: string): boolean {
   // First check if this date is reserved by someone else
   if (this.isDeskReservedOnDate(date) && !this.isCurrentUserReservation(date)) {
     // Never allow selection of dates reserved by others
     if (this.selectedBookingDates.has(date)) {
       console.warn(`Warning: Date ${date} is selected but reserved by someone else!`);
       // Auto-correct this invalid state by removing from selection
       this.selectedBookingDates.delete(date);
     }
     return false;
   }
   
   // Normal case - return if the date is in the selected set
   return this.selectedBookingDates.has(date);
 }

 // Note: Function implementation is at line ~966

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

 // Handle keyboard movement for selected desk or wall
 @HostListener('window:keydown', ['$event'])
 handleKeyboardNavigation(event: KeyboardEvent): void {
   // Only allow keyboard movement when not in confirmed mode
   if (this.isPlanConfirmed || !this.currentPlan) {
     return;
   }

   // Check if we have a selected desk
   if (this.selectedDesk) {
     this.handleDeskKeyboardMovement(event);
   } 
   // Otherwise check if we have a selected wall
   else if (this.selectedWall) {
     this.handleWallKeyboardMovement(event);
   }
 }
 
 // Handle keyboard movement for desks
 private handleDeskKeyboardMovement(event: KeyboardEvent): void {
   if (!this.selectedDesk || !this.currentPlan) return;
   
   // Get current desk position
   const desk = this.selectedDesk;
   let { left, top } = desk;
   
   // Always use the most precise movement (1px)
   const moveAmount = this.KEYBOARD_MOVE_SPEED;

   // Move based on arrow keys
   switch (event.key) {
     case 'ArrowLeft':
       left = Math.max(0, left - moveAmount);
       event.preventDefault();
       break;
     case 'ArrowRight':
       // Ensure desk stays within plan boundaries
       left = Math.min(this.currentPlan.width - this.DESK_WIDTH, left + moveAmount);
       event.preventDefault();
       break;
     case 'ArrowUp':
       top = Math.max(0, top - moveAmount);
       event.preventDefault();
       break;
     case 'ArrowDown':
       // Ensure desk stays within plan boundaries
       top = Math.min(this.currentPlan.height - this.DESK_HEIGHT, top + moveAmount);
       event.preventDefault();
       break;
     case 'r':
     case 'R':
       // Rotate desk when 'r' key is pressed
       this.rotateDesk(desk);
       event.preventDefault();
       break;
     default:
       // For other keys, do nothing
       return;
   }

   // Apply the new position to the desk
   desk.left = left;
   desk.top = top;

   // Show visual feedback that the desk was moved
   this.showDeskMovementFeedback();
 }
 
 // Handle keyboard movement for walls
 private handleWallKeyboardMovement(event: KeyboardEvent): void {
   if (!this.selectedWall || !this.currentPlan) return;
   
   // Get current wall position
   const wall = this.selectedWall;
   let { left, top, width, height } = wall;
   
   // Always use the most precise movement (1px)
   const moveAmount = this.KEYBOARD_MOVE_SPEED;

   // Move based on arrow keys
   switch (event.key) {
     case 'ArrowLeft':
       left = Math.max(0, left - moveAmount);
       event.preventDefault();
       break;
     case 'ArrowRight':
       // Ensure wall stays within plan boundaries
       left = Math.min(this.currentPlan.width - width, left + moveAmount);
       event.preventDefault();
       break;
     case 'ArrowUp':
       top = Math.max(0, top - moveAmount);
       event.preventDefault();
       break;
     case 'ArrowDown':
       // Ensure wall stays within plan boundaries
       top = Math.min(this.currentPlan.height - height, top + moveAmount);
       event.preventDefault();
       break;
     default:
       // For other keys, do nothing
       return;
   }

   // Apply the new position to the wall
   wall.left = left;
   wall.top = top;

   // Show visual feedback that the wall was moved
   this.showWallMovementFeedback();
 }

 // Show visual feedback when a desk is moved via keyboard
 private showDeskMovementFeedback(): void {
   if (!this.selectedDesk) return;
   
   // Add a temporary class to the selected desk element to show movement
   const deskElements = document.querySelectorAll('.desk');
   deskElements.forEach(element => {
     if (element.classList.contains('selected')) {
       element.classList.add('keyboard-moved');
       // No longer using the precise-mode visual indicator
       // as per user's request
       
       // Remove the movement class after animation completes
       setTimeout(() => {
         element.classList.remove('keyboard-moved');
       }, 300);
     }
   });
 }
 
 // Show visual feedback when a wall is moved via keyboard
 private showWallMovementFeedback(): void {
   if (!this.selectedWall) return;
   
   // Add a temporary class to the selected wall element to show movement
   const wallElements = document.querySelectorAll('.wall');
   wallElements.forEach(element => {
     if (element.classList.contains('selected')) {
       element.classList.add('keyboard-moved');
       
       // Remove the movement class after animation completes
       setTimeout(() => {
         element.classList.remove('keyboard-moved');
       }, 300);
     }
   });
 }
 
 // Helper method to round dimensions for display
 public roundDimension(value: number): number {
   return Math.round(value);
 }

 // Get count of available desks
 public getAvailableDeskCount(): number {
   if (!this.currentPlan || !this.currentPlan.desks) return 0;
   return this.currentPlan.desks.filter(desk => desk.available !== false).length;
 }

 // Get count of reserved desks
 public getReservedDeskCount(): number {
   if (!this.currentPlan || !this.currentPlan.desks) return 0;
   return this.currentPlan.desks.filter(desk => desk.available === false).length;
 }
 
 // Check if a new desk would overlap with any existing desks
 private checkDeskOverlap(plan: Plan, newX: number, newY: number): boolean {
   // Define the bounds of the new desk
   const newDeskBounds = {
     left: newX,
     right: newX + this.DESK_WIDTH,
     top: newY,
     bottom: newY + this.DESK_HEIGHT
   };
   
   // Check against each existing desk
   for (const existingDesk of plan.desks) {
     // Calculate rotation-adjusted bounds for existing desk
     // For simplicity, we'll use a conservative approximation that
     // doesn't account for rotation (since rotation complicates collision detection)
     const existingDeskBounds = {
       left: existingDesk.left,
       right: existingDesk.left + this.DESK_WIDTH,
       top: existingDesk.top,
       bottom: existingDesk.top + this.DESK_HEIGHT
     };
     
     // Check for overlap (standard AABB collision detection)
     if (newDeskBounds.left < existingDeskBounds.right &&
         newDeskBounds.right > existingDeskBounds.left &&
         newDeskBounds.top < existingDeskBounds.bottom &&
         newDeskBounds.bottom > existingDeskBounds.top) {
       return true; // Overlap detected
     }
   }
   
   return false; // No overlap
 }

 ngAfterViewInit(): void {
   if (this.designContainer) {
     this.designContainer.nativeElement.addEventListener('contextmenu', (event) => {
       event.preventDefault();
       return false;
     });
   }
   // ...any other logic that needs the nativeElement...
 }

 public tooltip: TooltipData | null = null;

  private isReservationByCurrentUser(reservation: Reservation): boolean {
    if (!this.currentUser) {
        return false;
    }
    // Prioritize ID match
    if (reservation.userId && this.currentUser.id) {
        return String(reservation.userId) === String(this.currentUser.id);
    }
    // Fallback to name match
    if (reservation.employeeName && this.currentUser.firstName && this.currentUser.lastName) {
        const currentUserFullName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
        return reservation.employeeName.toLowerCase().includes(currentUserFullName.toLowerCase());
    }
    return false;
  }

  showDeskTooltip(desk: Desk, event: MouseEvent) {
    if (this.showBookingDialog) return;
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;

    if (this.viewMode === 'week') {
      const weeklyStatus: WeeklyStatus[] = this.weekDates.map(date => {
        const reservations = this.reservationsByDate.get(date) || [];
        const reservation = reservations.find(r => r.deskId === desk.id);
        let dayStatus: 'available' | 'reserved' | 'own' = 'available';

        if (reservation) {
            dayStatus = this.isReservationByCurrentUser(reservation) ? 'own' : 'reserved';
        }
        return { date, status: dayStatus };
      });

      this.tooltip = {
        type: 'weekly',
        x: x,
        y: y,
        weeklyStatus: weeklyStatus
      };
    } else { // 'day' view
      let content = '';
      let status: 'available' | 'reserved' = 'available';

      if (desk.available) {
        content = 'Available';
        status = 'available';
      } else {
        content = `${desk.employeeName}, ${desk.duration === 'PM' ? 'Afternoon' : desk.duration === 'FULL' ? 'Full day' : 'Morning'}`;
        status = 'reserved';
      }

      this.tooltip = {
        type: 'simple',
        x: x,
        y: y,
        simpleContent: content,
        status: status
      };
    }
  }
  
  showDateTooltip(date: string, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8; // Position it 8px above the button

    let content = '';
    let status: 'available' | 'reserved' | 'info' = 'available';

    if (this.isDeskReservedOnDate(date)) {
        if (this.isCurrentUserReservation(date)) {
            content = 'Your reservation';
            status = 'info';
        } else {
            content = 'Reserved by another user';
            status = 'reserved';
        }
    } else if (this.isPastDate(date)) {
        content = 'Past date';
        status = 'reserved';
    }
    else {
      content = 'Available';
      status = 'available';
    }

    this.tooltip = {
      type: 'simple',
      x: x,
      y: y,
      simpleContent: content,
      status: status
    };
  }

  hideTooltip() {
    this.tooltip = null;
  }
}


