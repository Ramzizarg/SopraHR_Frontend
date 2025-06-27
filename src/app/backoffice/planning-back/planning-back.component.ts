import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../login/AuthService';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { UserService } from '../users/user.service';
import { TeletravailService, TeletravailResponse, TeletravailStatus } from '../../teletravail/TeletravailService';

// Planning response interface
interface PlanningResponse {
  id: number;
  userId: number;
  planningDate: string;
  planningStatus: 'TELETRAVAIL' | 'OFFICE' | 'PENDING';
  workType: 'Regular' | 'Exceptional';
  teamId?: number;
  teamName?: string;
  employeeName?: string;
  userName?: string;
  role?: string;
  team?: string;
}

interface TeletravailRequest {
  id: number;
  userId: number;
  date: string;
  status: string;
  type: string;
  // Add other properties as needed
}

@Component({
  selector: 'app-planning-back',
  templateUrl: './planning-back.component.html',
  styleUrls: ['./planning-back.component.css'],
  providers: [DatePipe]
})
export class PlanningBackComponent implements OnInit, OnDestroy {
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
  userProfilePhotos: Map<number, string | null> = new Map(); // Store user profile photos by userId

  // Planning properties
  planningEntries: PlanningResponse[] = [];
  originalPlanningEntries: PlanningResponse[] = [];
  teamMembers: any[] = [];
  uniqueEmployees: any[] = [];
  isManager = false;
  isTeamLeader = false;
  currentUserId = 0;
  currentTeamId?: number;
  currentTeamName?: string;
  startDate: string = '';
  endDate: string = '';
  selectedUserId?: number;
  showOnlyTeletravail: boolean = false;
  showAllUsers: boolean = false;
  showTeamLeadersOnly: boolean = false;
  searchEmployeeName: string = '';
  filteredEmployees: any[] = [];
  isCurrentWeek: boolean = true;
  isNextWeek: boolean = false;
  searchQuery: string = '';
  isAdmin: boolean = false;
  teletravailData: TeletravailResponse[] = [];

  // Add static property for logging combinations
  private static loggedCombinations = new Set<string>();

  constructor(
    public authService: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private userService: UserService,
    private teletravailService: TeletravailService
  ) {
    this.formattedDate = this.datePipe.transform(this.today, 'dd MMMM yyyy') || '';
    this.isAdmin = this.authService.currentUserValue?.role === 'ADMIN';
    this.isManager = this.authService.currentUserValue?.role === 'MANAGER';
    this.isTeamLeader = this.authService.currentUserValue?.role === 'TEAM_LEADER';
    this.showAllUsers = this.isAdmin;
  }

  ngOnInit(): void {
    // Initialize dates
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
    
    // Get Monday of current week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diff);
    
    // Set end date to Friday (4 days after Monday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);

    this.startDate = startOfWeek.toISOString().split('T')[0];
    this.endDate = endOfWeek.toISOString().split('T')[0];

    // Check if there's a stored profile photo URL in localStorage
    this.loadStoredProfilePhoto();
    
    // Fetch the current user's profile photo
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }

    // Initialize sidebar state
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);

    // Load initial data
    this.loadData();
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
    
    // If admin, load all users' data
    if (this.isAdmin) {
      this.userService.getAllUsers().subscribe({
        next: (users) => {
          // Map users to include userId field
          this.uniqueEmployees = users.map(user => ({
            ...user,
            userId: user.id, // Map id to userId
            employeeName: user.employeeName || `${user.firstName} ${user.lastName}`
          }));
          this.filteredEmployees = [...this.uniqueEmployees];
          
          // Fetch profile photos for all users
          this.uniqueEmployees.forEach(employee => {
            if (employee.userId) {
              this.userService.getUserProfilePhoto(employee.userId).subscribe({
                next: (photoUrl) => {
                  if (photoUrl) {
                    this.userProfilePhotos.set(employee.userId, photoUrl);
                  }
                },
                error: (error) => {
                  console.error('Error fetching profile photo for user', employee.userId, error);
                }
              });
            }
          });
          
          this.loadTeletravailData();
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement des utilisateurs';
      this.isLoading = false;
        }
      });
    } else {
      // Existing logic for non-admin users
      this.loadCurrentUserData();
    }
  }

  loadTeletravailData() {
    this.isLoading = true;
    this.error = null;

    // Load teletravail data for all users if admin
    if (this.isAdmin) {
      this.teletravailService.getAllRequests().subscribe({
        next: (data: TeletravailResponse[]) => {
          console.log('Received teletravail data:', data);
          // Filter data based on startDate and endDate
          this.teletravailData = data.filter(entry => {
            const entryDate = new Date(entry.teletravailDate);
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            return entryDate >= start && entryDate <= end;
          });
          console.log('Filtered teletravail data:', this.teletravailData);
          this.isLoading = false;
          // After loading data, update the filtered employees
          this.filterEmployeesByName();
        },
        error: (err) => {
          console.error('Error loading teletravail data:', err);
          this.error = 'Erreur lors du chargement des données de télétravail';
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de charger les données de télétravail. Veuillez réessayer.',
            confirmButtonText: 'OK'
          });
        }
      });
    } else {
      // For non-admin users, load their own requests
      this.loadCurrentUserTeletravailData();
    }
  }

  loadCurrentUserTeletravailData() {
    const currentUser = this.authService.currentUserValue;
    if (currentUser?.id) {
      this.isLoading = true;
      this.error = null;

      this.teletravailService.getUserRequests().subscribe({
        next: (data: TeletravailResponse[]) => {
          console.log('Received user teletravail data:', data);
          // Filter data based on startDate and endDate
          this.teletravailData = data.filter(entry => {
            const entryDate = new Date(entry.teletravailDate);
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            return entryDate >= start && entryDate <= end;
          });
          console.log('Filtered user teletravail data:', this.teletravailData);
          this.isLoading = false;
          // After loading data, update the filtered employees
          this.filterEmployeesByName();
        },
        error: (err) => {
          console.error('Error loading user teletravail data:', err);
          this.error = 'Erreur lors du chargement de vos données de télétravail';
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de charger vos données de télétravail. Veuillez réessayer.',
            confirmButtonText: 'OK'
          });
        }
      });
    } else {
      this.error = 'Utilisateur non connecté';
      this.isLoading = false;
    }
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

  // Planning methods
  getApprovedCount(): number {
    return this.planningEntries.filter(entry => 
      entry.planningStatus === 'TELETRAVAIL' && 
      (entry.workType === 'Regular' || entry.workType === 'Exceptional')
    ).length;
  }

  getPendingCount(): number {
    return this.planningEntries.filter(entry => 
      entry.planningStatus === 'PENDING'
    ).length;
  }

  filterEntries(): void {
    if (this.showTeamLeadersOnly) {
      this.filteredEmployees = this.uniqueEmployees.filter(employee => employee.role === 'TEAM_LEADER');
    } else {
      this.filteredEmployees = this.uniqueEmployees;
    }
  }

  toggleTeamLeadersOnly(): void {
    if (this.showTeamLeadersOnly) {
      this.filteredEmployees = this.uniqueEmployees.filter(emp => emp.role === 'TEAM_LEADER');
    } else {
      this.filteredEmployees = [...this.uniqueEmployees];
    }
  }

  filterEmployeesByName(): void {
    if (!this.searchEmployeeName) {
      this.filteredEmployees = [...this.uniqueEmployees];
      return;
    }

    const searchTerm = this.searchEmployeeName.toLowerCase();
    this.filteredEmployees = this.uniqueEmployees.filter(emp => 
      (emp.employeeName?.toLowerCase().includes(searchTerm) || 
       emp.userName?.toLowerCase().includes(searchTerm))
    );
  }

  clearEmployeeSearch(): void {
    this.searchEmployeeName = '';
    this.filteredEmployees = [...this.uniqueEmployees];
  }

  getDayLetter(dayIndex: number): string {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    return days[dayIndex];
  }

  getFormattedDateRange(): string {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  }

  getWeekDays(): Date[] {
    const days: Date[] = [];
    if (!this.startDate) {
      // If no start date is set, use current date
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
      
      // Get Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      
      // Add only weekdays (Monday through Friday)
      for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push(day);
      }
    } else {
      // Use the startDate from the component
      const start = new Date(this.startDate);
      // Add only weekdays (Monday through Friday)
      for (let i = 0; i < 5; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        days.push(day);
      }
    }
    return days;
  }

  getEmployeeStatusForDate(userId: number, date: Date): string {
    if (!userId) {
      console.error('getEmployeeStatusForDate called with undefined userId');
      return 'OFFICE';
    }

    // Format date to compare with entry dates
    const dateStr = this.datePipe.transform(date, 'yyyy-MM-dd') || '';
    
    // Find matching entry for this employee and date
    const entry = this.teletravailData.find(entry => 
      entry.userId === userId && 
      entry.teletravailDate.split('T')[0] === dateStr
    );
    
    // Only log if we found an entry and haven't logged it before
    if (entry) {
      const logKey = `${entry.id}-${entry.userId}-${entry.teletravailDate}`;
      if (!PlanningBackComponent.loggedCombinations.has(logKey)) {
        console.log('Found teletravail entry:', {
          userId,
          date: dateStr,
          entry,
          travailMaison: entry.travailMaison,
          status: entry.status
        });
        PlanningBackComponent.loggedCombinations.add(logKey);
      }
    }

    if (!entry) {
      return 'OFFICE'; // Default to office if no entry found
    }

    // Check if travailMaison is true
    if (entry.travailMaison === 'true') {
      // Map the status to match the planning page logic
      switch (entry.status) {
        case 'APPROVED':
          return 'TELETRAVAIL';
        case 'PENDING':
          return 'PENDING';
        case 'REJECTED':
          return 'OFFICE';
        default:
          return 'OFFICE';
      }
    }

    return 'OFFICE';
  }

  getWorkTypeForDate(userId: number, date: Date): string {
    // Format date to compare with entry dates
    const dateStr = this.datePipe.transform(date, 'yyyy-MM-dd') || '';
    
    // Find matching entry for this employee and date
    const entry = this.teletravailData.find(entry => 
      entry.userId === userId && 
      entry.teletravailDate.split('T')[0] === dateStr
    );
    
    if (!entry || !entry.travailType) {
      // Default to Regular when no entry is found or no workType is specified
      return 'Regular';
    }
    
    // Normalize workType to handle different capitalizations
    const workType = entry.travailType.toLowerCase();
    
    // Create a unique key for this user-date combination
    const logKey = `${userId}-${dateStr}`;
    
    // Only log if we haven't seen this combination before
    if (!PlanningBackComponent.loggedCombinations.has(logKey)) {
      console.log(`Work type for user ${userId} on ${dateStr}: ${workType}`);
      PlanningBackComponent.loggedCombinations.add(logKey);
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

  getRoleLabel(role: string): string {
    const roleLabels: { [key: string]: string } = {
      'EMPLOYEE': 'Employé',
      'TEAM_LEADER': 'Chef d\'équipe',
      'MANAGER': 'Manager',
      'ADMIN': 'Administrateur'
    };
    return roleLabels[role] || role;
  }

  getPlanningEntry(userId: number, date: Date): any {
    // Format the date to match the backend format (YYYY-MM-DD)
    const formattedDate = date.toISOString().split('T')[0];
    
    // Find the matching entry
    return this.teletravailData.find(e => 
      e.userId === userId && 
      e.teletravailDate.split('T')[0] === formattedDate
    );
  }

  showNextWeek(): void {
    const currentStart = new Date(this.startDate);
    // Add 7 days to get to next week
    currentStart.setDate(currentStart.getDate() + 7);
    // Adjust to Monday if it's a weekend
    const day = currentStart.getDay();
    if (day === 0) { // Sunday
      currentStart.setDate(currentStart.getDate() + 1); // Move to Monday
    } else if (day === 6) { // Saturday
      currentStart.setDate(currentStart.getDate() + 2); // Move to Monday
    }
    this.startDate = currentStart.toISOString().split('T')[0];
    
    const currentEnd = new Date(currentStart);
    // Set end date to Friday (4 days after Monday)
    currentEnd.setDate(currentStart.getDate() + 4);
    this.endDate = currentEnd.toISOString().split('T')[0];
    
    // Update current week status
    const today = new Date();
    this.isCurrentWeek = today.getTime() >= currentStart.getTime() && 
                        today.getTime() <= currentEnd.getTime();
    this.isNextWeek = false;
    
    this.loadData();
  }

  showPreviousWeek(): void {
    const currentStart = new Date(this.startDate);
    // Subtract 7 days to get to previous week
    currentStart.setDate(currentStart.getDate() - 7);
    // Adjust to Monday if it's a weekend
    const day = currentStart.getDay();
    if (day === 0) { // Sunday
      currentStart.setDate(currentStart.getDate() + 1); // Move to Monday
    } else if (day === 6) { // Saturday
      currentStart.setDate(currentStart.getDate() + 2); // Move to Monday
    }
    this.startDate = currentStart.toISOString().split('T')[0];
    
    const currentEnd = new Date(currentStart);
    // Set end date to Friday (4 days after Monday)
    currentEnd.setDate(currentStart.getDate() + 4);
    this.endDate = currentEnd.toISOString().split('T')[0];
    
    // Update current week status
    const today = new Date();
    this.isCurrentWeek = today.getTime() >= currentStart.getTime() && 
                        today.getTime() <= currentEnd.getTime();
    this.isNextWeek = false;
    
    this.loadData();
  }

  handleStatusClick(event: MouseEvent, entry: any): void {
    if (!entry || !this.isManager && !this.isTeamLeader) return;

    if (entry.status === 'PENDING') {
      this.showApprovalOptions(entry);
    } else if (entry.status === 'TELETRAVAIL') {
      this.cancelTeletravailRequest(entry.id);
    }
  }

  private updateRequestStatus(requestId: number, status: TeletravailStatus, rejectionReason?: string): void {
    this.teletravailService.updateRequestStatus(requestId, { status, rejectionReason }).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Succès',
          text: status === TeletravailStatus.APPROVED ? 'Demande approuvée avec succès' : 'Demande refusée avec succès',
          timer: 2000,
          showConfirmButton: false
        });
        this.loadTeletravailData(); // Reload data
      },
      error: (err) => {
        console.error('Error updating request status:', err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Une erreur est survenue lors de la mise à jour du statut',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  private showApprovalOptions(entry: any): void {
    Swal.fire({
      title: 'Approuver la demande de télétravail',
      html: `
        <div class="approval-options">
          <p>Voulez-vous approuver ou refuser cette demande de télétravail ?</p>
          <div class="form-group">
            <label for="rejectionReason">Raison du refus (si applicable):</label>
            <textarea id="rejectionReason" class="form-control" rows="3"></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Approuver',
      cancelButtonText: 'Refuser',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Approve request
        this.updateRequestStatus(entry.id, TeletravailStatus.APPROVED);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Reject request
        const rejectionReason = (document.getElementById('rejectionReason') as HTMLTextAreaElement).value;
        this.updateRequestStatus(entry.id, TeletravailStatus.REJECTED, rejectionReason);
      }
    });
  }

  private cancelTeletravailRequest(id: number): void {
    Swal.fire({
      title: 'Annuler le télétravail',
      text: 'Êtes-vous sûr de vouloir annuler ce télétravail ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Non'
    }).then((result) => {
      if (result.isConfirmed) {
        this.teletravailService.updateRequestStatus(id, { status: TeletravailStatus.REJECTED }).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Succès',
              text: 'Télétravail annulé avec succès',
              timer: 2000,
              showConfirmButton: false
            });
            this.loadTeletravailData(); // Reload data
          },
          error: (err) => {
            console.error('Error canceling teletravail:', err);
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Une erreur est survenue lors de l\'annulation du télétravail',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  onSearch() {
    if (!this.searchQuery) {
      this.filteredEmployees = this.uniqueEmployees;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredEmployees = this.uniqueEmployees.filter(employee => 
      employee.firstName.toLowerCase().includes(query) ||
      employee.lastName.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query)
    );
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredEmployees = this.uniqueEmployees;
  }

  loadCurrentUserData() {
    // Load data for current user
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.uniqueEmployees = [currentUser];
      this.filteredEmployees = [currentUser];
      this.loadCurrentUserTeletravailData();
    }
  }
}
