import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../login/AuthService';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { UserService } from '../users/user.service';
import { TeletravailbackService, TeletravailRequest } from './teletravailback.service';

@Component({
  selector: 'app-teletravail-back',
  templateUrl: './teletravail-back.component.html',
  styleUrls: ['./teletravail-back.component.css'],
  providers: [DatePipe]
})
export class TeletravailBackComponent implements OnInit, OnDestroy {
  @ViewChild('profileElement') profileElement!: ElementRef;
  
  // Sidebar and UI states
  isSidebarOpen: boolean = true;
  isProfileDropdownOpen: boolean = false;
  searchTerm: string = '';
  
  // Filter properties
  selectedTeam: string = '';
  selectedWorkType: string = '';
  selectedStatus: string = '';
  startDate: string = '';
  endDate: string = '';
  
  // Date formatting
  today: Date = new Date();
  formattedDate: string = '';
  
  // Loading states
  isLoading: boolean = false;
  error: string | null = null;
  private subscriptions: Subscription = new Subscription();

  // Profile photo storage
  userProfilePhotos: Map<number, string> = new Map(); // Store user profile photos by userId

  // Telework requests
  teleworkRequests: TeletravailRequest[] = [];
  filteredRequests: TeletravailRequest[] = [];

  // Available teams and work types for filters
  teams: string[] = ['DEV', 'QA', 'OPS', 'RH'];
  workTypes: string[] = ['Exceptionnelle', 'Regulière'];
  statuses: string[] = ['PENDING', 'APPROVED', 'REJECTED'];

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  allFilteredRequests: TeletravailRequest[] = [];

  constructor(
    public authService: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private userService: UserService,
    private teletravailService: TeletravailbackService
  ) {
    this.formattedDate = this.datePipe.transform(this.today, 'dd MMMM yyyy') || '';
  }

  ngOnInit(): void {
    this.loadStoredProfilePhoto();
    
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }

    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);

    // Ensure user profile is loaded before checking role
    this.subscriptions.add(
      this.authService.ensureProfileLoaded().subscribe({
        next: (user) => {
          if (this.authService.isAdmin()) {
            this.loadData();
          } else {
            this.error = 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.';
            Swal.fire({
              title: 'Accès refusé',
              text: 'Vous devez avoir le rôle d\'administrateur pour accéder à cette page.',
              icon: 'error',
              confirmButtonText: 'OK'
            }).then(() => {
              this.router.navigate(['/backoffice/dashboard']);
            });
          }
        },
        error: (err) => {
          console.error('Error loading user profile:', err);
          this.error = 'Erreur lors du chargement du profil utilisateur';
          this.router.navigate(['/login']);
        }
      })
    );
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
          // Update the filtered requests to show the new photo
          this.filterRequests();
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

    this.teletravailService.getAllRequests().subscribe({
      next: (requests) => {
        this.teleworkRequests = requests;
        // Fetch profile photos for each request
        requests.forEach(request => {
          if (request.userId) {
            this.fetchUserProfilePhoto(request.userId);
          }
        });
        this.filterRequests();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading telework requests:', err);
        this.error = 'Erreur lors du chargement des demandes de télétravail';
        this.isLoading = false;
      }
    });
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

  updateRequestStatus(request: TeletravailRequest, newStatus: string): void {
    if (newStatus === 'REJECTED') {
      Swal.fire({
        title: 'Raison du rejet',
        input: 'textarea',
        inputPlaceholder: 'Entrez la raison du rejet...',
        showCancelButton: true,
        confirmButtonText: 'Rejeter',
        cancelButtonText: 'Annuler',
        inputValidator: (value) => {
          if (!value) {
            return 'La raison du rejet est requise';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.processStatusUpdate(request, newStatus, result.value);
        }
      });
    } else {
      this.processStatusUpdate(request, newStatus);
    }
  }

  private processStatusUpdate(request: TeletravailRequest, newStatus: string, rejectionReason?: string): void {
    this.teletravailService.updateRequestStatus(request.id, newStatus, rejectionReason).subscribe({
      next: (updatedRequest) => {
        const index = this.teleworkRequests.findIndex(r => r.id === request.id);
        if (index !== -1) {
          this.teleworkRequests[index] = updatedRequest;
          this.filteredRequests = [...this.teleworkRequests];
        }
        Swal.fire({
          title: 'Succès',
          text: `La demande a été ${newStatus === 'APPROVED' ? 'approuvée' : 'rejetée'} avec succès`,
          icon: 'success'
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Erreur',
          text: 'Une erreur est survenue lors de la mise à jour du statut',
          icon: 'error'
        });
        console.error('Error updating request status:', err);
      }
    });
  }

  deleteRequest(requestId: number): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: 'Êtes-vous sûr de vouloir supprimer cette demande de télétravail ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.teletravailService.deleteRequest(requestId).subscribe({
          next: () => {
            Swal.fire({
              title: 'Succès',
              text: 'La demande de télétravail a été supprimée avec succès',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            this.loadData();
          },
          error: (error) => {
            console.error('Error deleting request:', error);
            Swal.fire({
              title: 'Erreur',
              text: 'Une erreur est survenue lors de la suppression de la demande',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  /**
   * Filter requests based on search term, team, work type, status, and date range.
   */
  filterRequests(): void {
    this.allFilteredRequests = this.teleworkRequests.filter(request => {
      const matchesSearchTerm = this.searchTerm === '' ||
        request.userName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        request.team.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        request.travailType.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(this.searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()) ||
        request.status.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesTeam = this.selectedTeam === '' || request.team === this.selectedTeam;
      const matchesWorkType = this.selectedWorkType === '' ||
        request.travailType.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() === this.selectedWorkType.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const matchesStatus = this.selectedStatus === '' || request.status === this.selectedStatus;

      const requestDate = new Date(request.teletravailDate);
      const start = this.startDate ? new Date(this.startDate) : null;
      const end = this.endDate ? new Date(this.endDate) : null;

      const matchesDateRange = (!start || requestDate >= start) && (!end || requestDate <= end);

      return matchesSearchTerm && matchesTeam && matchesWorkType && matchesStatus && matchesDateRange;
    });

    // Update pagination after filtering
    this.currentPage = 1;
    this.updatePagination();
  }

  /**
   * Handle team filter change
   */
  onTeamChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTeam = select.value;
    this.filterRequests();
  }

  /**
   * Handle work type filter change
   */
  onWorkTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedWorkType = select.value;
    this.filterRequests();
  }

  /**
   * Handle date range changes
   */
  onDateRangeChange(): void {
    this.filterRequests();
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedTeam = '';
    this.selectedWorkType = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.filterRequests();
  }

  /**
   * Get initials from employee name
   * @param name The employee name
   * @returns The initials or empty string if name is invalid
   */
  getInitials(name: string | null | undefined): string {
    if (!name) return '';
    
    const parts = name.split(' ');
    const firstInitial = parts[0] ? parts[0][0] : '';
    const secondInitial = parts[1] ? parts[1][0] : '';
    
    return (firstInitial + secondInitial).toUpperCase();
  }

  /**
   * Approve a teletravail request
   */
  approveRequest(requestId: number): void {
    Swal.fire({
      title: 'Confirmer l\'approbation',
      text: 'Êtes-vous sûr de vouloir approuver cette demande de télétravail ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, approuver',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.teletravailService.updateRequestStatus(requestId, 'APPROVED').subscribe({
          next: () => {
            Swal.fire({
              title: 'Succès',
              text: 'La demande de télétravail a été approuvée avec succès',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            this.loadData();
          },
          error: (error) => {
            console.error('Error approving request:', error);
            Swal.fire({
              title: 'Erreur',
              text: 'Une erreur est survenue lors de l\'approbation de la demande',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  /**
   * Reject a teletravail request
   */
  rejectRequest(requestId: number): void {
    Swal.fire({
      title: 'Rejeter la demande',
      text: 'Veuillez indiquer la raison du rejet',
      input: 'textarea',
      inputPlaceholder: 'Raison du rejet...',
      showCancelButton: true,
      confirmButtonText: 'Rejeter',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      inputValidator: (value) => {
        if (!value) {
          return 'La raison du rejet est requise';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.teletravailService.updateRequestStatus(requestId, 'REJECTED', result.value).subscribe({
          next: () => {
            Swal.fire({
              title: 'Succès',
              text: 'La demande de télétravail a été rejetée',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            this.loadData();
          },
          error: (error) => {
            console.error('Error rejecting request:', error);
            Swal.fire({
              title: 'Erreur',
              text: 'Une erreur est survenue lors du rejet de la demande',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }

  getWorkTypeClass(type: string): string {
    if (!type) return 'reguliere';
    const normalized = type.trim().toLowerCase();
    if (normalized === 'exceptionnelle') {
      return 'exceptionnelle';
    } else if (normalized === 'regulière' || normalized === 'reguliere') {
      return 'reguliere';
    }
    return 'reguliere';
  }

  /**
   * Export telework requests data to CSV.
   */
  exportTeleworkData(): void {
    console.log('Exporting telework data...');
    
    try {
      const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility with French characters
      
      const headers = [
        'ID',
        'Nom Utilisateur',
        'Équipe',
        'Date de Télétravail',
        'Statut',
        'Type de Travail',
        'Raison du Rejet'
      ];
      let csvContent = BOM; // Add BOM at the beginning
      csvContent += this.formatCSVRow(headers);
      
      this.filteredRequests.forEach(request => {
        const row = [
          request.id.toString(),
          request.userName || '',
          request.team,
          this.datePipe.transform(request.teletravailDate, 'dd/MM/yyyy') || '',
          request.status,
          request.travailType,
          request.rejectionReason || ''
        ];
        csvContent += this.formatCSVRow(row);
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'demandes_teletravail.csv';
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      this.showSuccessMessage('Données de télétravail exportées avec succès');
    } catch (error) {
      console.error('Export failed:', error);
      this.showErrorMessage('Échec de l\'export. Veuillez réessayer.');
    }
  }
  
  /**
   * Helper for CSV formatting.
   * Properly escapes fields containing commas, quotes, etc.
   */
  private formatCSVRow(row: string[]): string {
    const formattedRow = row.map(field => {
      if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    });
    return formattedRow.join(';') + '\r\n'; // Excel prefers semicolons and CRLF line endings
  }

  /**
   * Show a success message using SweetAlert2.
   * @param message The message to display.
   */
  showSuccessMessage(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Succès',
      text: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }

  /**
   * Show an error message using SweetAlert2.
   * @param message The message to display.
   */
  showErrorMessage(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Erreur',
      text: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
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
}
