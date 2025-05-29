import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { UserService, User, UserRequest } from './user.service';
import { AuthService } from '../../login/AuthService';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  searchTerm: string = '';
  selectedTeam: string = '';
  selectedRole: string = '';
  teams: string[] = ['DEV', 'QA', 'OPS', 'RH'];
  roles: string[] = ['EMPLOYEE', 'ADMIN', 'MANAGER', 'TEAM_LEADER'];
  loading: boolean = false;
  error: string = '';
  paginatedUsers: User[] = [];
  filteredUsers: User[] = [];
  users: User[] = [];
  activeDropdown: number | null = null;
  actionMenuPosition = { x: 0, y: 0 };
  activeUser: User | null = null;
  userProfilePhotos: Map<number, string> = new Map(); // Store user profile photos by userId
  isSidebarOpen: boolean = true;
  
  // UI enhancements
  sortColumn: string = 'firstName';
  isProfileDropdownOpen: boolean = false;
  @ViewChild('profileElement') profileElement!: ElementRef;
  sortDirection: 'asc' | 'desc' = 'asc';
  successMessage: string = '';
  showSuccess: boolean = false;
  itemsPerPage: number = 10;
  currentPage: number = 1;

  constructor(private userService: UserService, private router: Router, public authService: AuthService) {}
  
  // Profile dropdown methods
  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }
  
  // Close profile dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event): void {
    if (this.profileElement && !this.profileElement.nativeElement.contains(event.target)) {
      this.isProfileDropdownOpen = false;
    }
  }
  
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
            
            // Draw the image
            drawImage();
            
            // Setup event listeners for cropping
            setupCropEvents();
          }
          
          // Draw the image on the canvas
          function drawImage() {
            cropContext.clearRect(0, 0, cropSize, cropSize);
            
            // Save the context state
            cropContext.save();
            
            // Translate to the center of the canvas
            cropContext.translate(cropSize / 2, cropSize / 2);
            
            // Rotate around the center
            cropContext.rotate(rotation * Math.PI / 180);
            
            // Draw the image centered
            const w = originalImage.width * scale;
            const h = originalImage.height * scale;
            cropContext.drawImage(originalImage, -w/2 + imgX, -h/2 + imgY, w, h);
            
            // Restore the context state
            cropContext.restore();
            
            // Draw crop overlay
            drawCropOverlay();
          }
          
          // Draw a circular overlay to show the crop area
          function drawCropOverlay() {
            const overlayEl = document.getElementById('cropOverlay');
            overlayEl.style.width = cropSize + 'px';
            overlayEl.style.height = cropSize + 'px';
            overlayEl.style.borderRadius = '50%';
            overlayEl.style.boxShadow = '0 0 0 100vmax rgba(0, 0, 0, 0.5)';
          }
          
          // Setup event listeners for cropping interface
          function setupCropEvents() {
            // Zoom buttons
            document.getElementById('zoomInBtn').addEventListener('click', function() {
              scale *= 1.1;
              drawImage();
            });
            
            document.getElementById('zoomOutBtn').addEventListener('click', function() {
              scale *= 0.9;
              drawImage();
            });
            
            // Rotation buttons
            document.getElementById('rotateLeftBtn').addEventListener('click', function() {
              rotation -= 90;
              drawImage();
            });
            
            document.getElementById('rotateRightBtn').addEventListener('click', function() {
              rotation += 90;
              drawImage();
            });
            
            // Dragging to move image
            cropCanvas.addEventListener('mousedown', function(e) {
              dragging = true;
              dragStartX = e.clientX;
              dragStartY = e.clientY;
            });
            
            cropCanvas.addEventListener('mousemove', function(e) {
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
            
            cropCanvas.addEventListener('mouseup', function() {
              dragging = false;
            });
            
            cropCanvas.addEventListener('mouseleave', function() {
              dragging = false;
            });
            
            // Touch events for mobile
            cropCanvas.addEventListener('touchstart', function(e) {
              dragging = true;
              dragStartX = e.touches[0].clientX;
              dragStartY = e.touches[0].clientY;
            });
            
            cropCanvas.addEventListener('touchmove', function(e) {
              if (dragging) {
                const dx = e.touches[0].clientX - dragStartX;
                const dy = e.touches[0].clientY - dragStartY;
                imgX += dx;
                imgY += dy;
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                drawImage();
                e.preventDefault(); // Prevent scrolling while dragging
              }
            });
            
            cropCanvas.addEventListener('touchend', function() {
              dragging = false;
            });
            
            // Apply and cancel buttons
            document.getElementById('applyCropBtn').addEventListener('click', function() {
              applyCrop();
            });
            
            document.getElementById('cancelCropBtn').addEventListener('click', function() {
              cancelCrop();
            });
          }
          
          // Apply the crop and show preview
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
            
            // Get the cropped image data
            croppedImage = finalCanvas.toDataURL('image/png');
            
            // Update the preview
            const currentPhotoPreview = document.getElementById('currentPhotoPreview');
            currentPhotoPreview.innerHTML = '';
            currentPhotoPreview.style.display = 'flex';
            
            // Add the cropped image
            const newImg = document.createElement('img');
            newImg.src = croppedImage;
            newImg.alt = 'Cropped Profile Photo';
            currentPhotoPreview.appendChild(newImg);
            
            // Re-add the camera overlay
            const overlay = document.createElement('div');
            overlay.className = 'photo-edit-overlay';
            overlay.innerHTML = '<i class="bi bi-camera-fill"></i>';
            currentPhotoPreview.appendChild(overlay);
            
            // Update instructions and hide cropper
            document.querySelector('.photo-instructions').textContent = 'Photo recadrée (cliquez pour changer)';
            document.querySelector('.photo-instructions').style.display = 'block';
            document.getElementById('cropContainer').style.display = 'none';
            
            // Save the cropped image for upload
            saveBase64AsFile(croppedImage);
          }
          
          // Convert base64 to file for upload
          function saveBase64AsFile(base64) {
            const byteString = atob(base64.split(',')[1]);
            const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            
            const blob = new Blob([ab], { type: mimeString });
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
            font-size: 1.8rem;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          }
          .photo-instructions {
            font-size: 13px;
            color: #6B7280;
            margin-top: 8px;
          }
          
          /* Cropping interface styles */
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
          .preview-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 15px;
          }
          .photo-preview {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #3B82F6;
          }
          .preview-label {
            font-size: 13px;
            color: #6B7280;
            margin-top: 5px;
          }
        `;
        document.head.appendChild(style);
      },
      preConfirm: () => {
        // Get the selected file
        const fileInput = document.getElementById('profilePhoto') as HTMLInputElement;
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          // Check file type and size
          if (!file.type.match('image.*')) {
            Swal.showValidationMessage('Veuillez sélectionner une image valide');
            return false;
          }
          if (file.size > 5 * 1024 * 1024) { // 5MB max
            Swal.showValidationMessage('L\'image est trop grande. Maximum 5MB.');
            return false;
          }
          return { file };
        } else {
          // If no file is selected, just return success without changes
          return { noChanges: true };
        }
      }
    }).then((result) => {
      if (result.isConfirmed && result.value && !result.value.noChanges) {
        // Show loading state
        Swal.fire({
          title: 'Mise à jour...',
          text: 'Mise à jour de votre photo de profil',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        // Upload the profile photo
        const userId = this.authService.currentUserValue?.id;
        if (userId && result.value.file) {
          this.userService.uploadProfilePhoto(userId, result.value.file)
            .subscribe({
              next: (photoUrl) => {
                // Update the current user's profile photo URL
                if (this.authService.currentUserValue) {
                  this.authService.currentUserValue.profilePhotoUrl = photoUrl;
                  // Force UI update
                  this.authService.updateCurrentUser(this.authService.currentUserValue);
                  
                  // Also store in localStorage to persist between page refreshes
                  try {
                    // Store the profile photo URL in localStorage
                    localStorage.setItem('userProfilePhoto', photoUrl);
                    console.log('Profile photo URL saved to localStorage');
                  } catch (e) {
                    console.error('Error saving profile photo to localStorage:', e);
                  }
                }
                
                Swal.fire({
                  icon: 'success',
                  title: 'Succès!',
                  text: 'Photo de profil mise à jour avec succès',
                  timer: 2000,
                  showConfirmButton: false
                });
              },
              error: (error) => {
                console.error('Error uploading profile photo:', error);
                Swal.fire({
                  icon: 'error',
                  title: 'Erreur',
                  text: 'Impossible de mettre à jour la photo de profil. Veuillez réessayer.'
                });
              }
            });
        }
      }
    });
  }
  
  openAccountSettings(): void {
    Swal.fire('Account Settings', 'Account settings functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }
  
  getSupport(): void {
    Swal.fire('Support', 'Support functionality will be implemented soon.', 'info');
    this.isProfileDropdownOpen = false;
  }
  
  // This method is now handled by the logout method at the bottom of the file
  
  // Handle profile image errors by hiding the image and letting the avatar circle with initials show instead
  handleImageError(event: any): void {
    // Hide the image that failed to load
    event.target.style.display = 'none';
    
    // Try to find parent .user-profile and add a class to show the avatar circle
    const parent = event.target.closest('.user-profile');
    if (parent) {
      // Create and append the avatar circle with initials
      const avatarCircle = document.createElement('div');
      avatarCircle.className = 'avatar-circle';
      
      // Set background color based on user's team
      const team = this.authService.currentUserValue?.team || '';
      let bgColor = '#7E22CE'; // Default purple
      if (team === 'DEV') bgColor = '#3B82F6';
      else if (team === 'QA') bgColor = '#16A34A';
      else if (team === 'OPS') bgColor = '#0369A1';
      
      avatarCircle.style.backgroundColor = bgColor;
      
      // Add initials
      const firstName = this.authService.currentUserValue?.firstName || '';
      const lastName = this.authService.currentUserValue?.lastName || '';
      avatarCircle.textContent = firstName.charAt(0) + lastName.charAt(0);
      
      // Replace the image with the avatar circle
      parent.appendChild(avatarCircle);
    }
  }

  ngOnInit(): void {
    this.loadUsers();
    
    // Check if there's a stored profile photo URL in localStorage
    this.loadStoredProfilePhoto();
    this.setupKeyboardNavigation();
    
    // Load sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('sidebarState');
    if (savedSidebarState === 'collapsed') {
      this.isSidebarOpen = false;
      document.body.classList.add('sidebar-collapsed');
    } else {
      this.isSidebarOpen = true;
      document.body.classList.remove('sidebar-collapsed');
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.userService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.users = users;
        this.filteredUsers = [...this.users];
        this.loading = false;
        
        // Apply initial pagination
        this.updatePagination();
        
        // Fetch profile photos for all users
        this.users.forEach(user => {
          this.fetchUserProfilePhoto(user.id);
        });
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des utilisateurs';
        this.loading = false;
        console.error(err);
      }
    });
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

  onTeamChange(event: any): void {
    this.selectedTeam = event.target.value;
    this.applyFilters();
  }

  onRoleChange(event: any): void {
    this.selectedRole = event.target.value;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      // Apply team filter
      const teamMatch = this.selectedTeam ? user.team === this.selectedTeam : true;
      
      // Apply role filter
      const roleMatch = this.selectedRole ? user.role === this.selectedRole : true;
      
      // Apply search filter (case insensitive)
      const searchMatch = !this.searchTerm || 
        user.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return teamMatch && roleMatch && searchMatch;
    });
    
    // After filtering, sort and update pagination
    this.sortUsers(this.sortColumn, this.sortDirection);
    this.currentPage = 1; // Reset to first page when filtering
    this.updatePagination();
  }
  
  toggleSidebar(): void {
    // Toggle sidebar state
    this.isSidebarOpen = !this.isSidebarOpen;
    
    // Apply or remove the collapsed class from the body
    if (this.isSidebarOpen) {
      document.body.classList.remove('sidebar-collapsed');
    } else {
      document.body.classList.add('sidebar-collapsed');
    }
    
    // For mobile view, handle the sidebar-open class
    if (window.innerWidth <= 768) {
      if (this.isSidebarOpen) {
        document.body.classList.add('sidebar-open');
      } else {
        document.body.classList.remove('sidebar-open');
      }
    }
    
    // Log state for debugging
    console.log('Sidebar toggled:', this.isSidebarOpen ? 'expanded' : 'collapsed', document.body.className);
    
    // Save user preference in localStorage
    localStorage.setItem('sidebarState', this.isSidebarOpen ? 'expanded' : 'collapsed');
  }

  // User action methods
  toggleDropdown(event: MouseEvent, userId: number): void {
    // Prevent event propagation to avoid closing the dropdown
    event.stopPropagation();
    
    // Toggle dropdown or close if same is clicked
    if (this.activeDropdown === userId) {
      this.activeDropdown = null;
      return;
    }
    
    this.activeDropdown = userId;
    
    // Position the dropdown after a brief delay to ensure the DOM is updated
    setTimeout(() => {
      // Find the dropdown button and dropdown menu
      const button = event.currentTarget as HTMLElement;
      const dropdown = button.parentElement?.querySelector('.floating-action-dropdown') as HTMLElement;
      
      if (dropdown) {
        // Get button position
        const rect = button.getBoundingClientRect();
        
        // Calculate position to place the dropdown at the right position
        const top = rect.bottom + window.scrollY + 5; // 5px below the button
        const right = window.innerWidth - rect.right - window.scrollX;
        
        // Set the dropdown position
        dropdown.style.position = 'absolute';
        dropdown.style.top = `${top}px`;
        dropdown.style.right = `${right}px`;
        dropdown.style.zIndex = '9999';
        
        // Ensure the dropdown doesn't go beyond screen boundaries
        const dropdownRect = dropdown.getBoundingClientRect();
        if (dropdownRect.bottom > window.innerHeight) {
          // Position above if no space below
          dropdown.style.top = `${rect.top + window.scrollY - dropdownRect.height - 5}px`;
        }
      }
    }, 0);
  }
  
  @HostListener('document:click')
  closeAllDropdowns(): void {
    this.activeDropdown = null;
  }
  
  // Enhanced action menu with animation and better positioning
  setActiveUser(userId: number, event?: MouseEvent): void {
    event?.stopPropagation();
    
    // Add visual feedback on button click
    if (event) {
      const target = event.currentTarget as HTMLElement;
      this.addRippleEffect(target);
    }
    
    // Find the user
    this.activeUser = this.users.find(u => u.id === userId) || null;
    this.activeDropdown = userId;
    
    // Position the menu with optimal UX
    this.positionActionMenu(userId, event);
    
    // Add entrance animation class after a short delay
    setTimeout(() => {
      const menu = document.querySelector('.action-menu-content') as HTMLElement;
      if (menu) {
        menu.classList.add('menu-animated');
        
        // Add subtle scale animation to menu items
        const items = menu.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => {
            (item as HTMLElement).style.opacity = '1';
            (item as HTMLElement).style.transform = 'translateY(0)';
          }, 50 * index);
        });
      }
    }, 20);
  }
  
  // Separate positioning logic for better organization
  private positionActionMenu(userId: number, event?: MouseEvent): void {
    // Position the menu near the click point with smart positioning
    if (event) {
      // Position relative to click with slight offset
      this.actionMenuPosition = {
        x: event.clientX - 100, // Center horizontally near click
        y: event.clientY + 15   // Position below click point
      };
    } else {
      // Find the button element by user ID
      const button = document.querySelector(`[data-user-id="${userId}"]`) as HTMLElement;
      if (button) {
        const rect = button.getBoundingClientRect();
        this.actionMenuPosition = {
          x: rect.right - 150, // Position to the left of the button
          y: rect.bottom + 10  // Position below the button
        };
      } else {
        // Default position in case button not found
        this.actionMenuPosition = {
          x: window.innerWidth / 2 - 100,
          y: window.innerHeight / 2 - 100
        };
      }
    }
    
    // Ensure menu is fully visible within viewport
    if (this.actionMenuPosition.x < 10) this.actionMenuPosition.x = 10;
    if (this.actionMenuPosition.y < 10) this.actionMenuPosition.y = 10;
    if (this.actionMenuPosition.x > window.innerWidth - 210) {
      this.actionMenuPosition.x = window.innerWidth - 210;
    }
    if (this.actionMenuPosition.y > window.innerHeight - 200) {
      this.actionMenuPosition.y = window.innerHeight - 200;
    }
  }
  
  // Add ripple effect for better click feedback
  private addRippleEffect(element: HTMLElement): void {
    // Create ripple element
    const ripple = document.createElement('span');
    ripple.classList.add('ripple-effect');
    
    // Style for ripple
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s linear';
    ripple.style.pointerEvents = 'none';
    
    // Calculate position and size
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${rect.width / 2 - size / 2}px`;
    ripple.style.top = `${rect.height / 2 - size / 2}px`;
    
    // Add to element and remove after animation
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
  
  // Close the action menu
  closeActionMenu(event: MouseEvent): void {
    // Close only if clicking outside the menu content
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu-content')) {
      this.activeDropdown = null;
      this.activeUser = null;
    }
  }
  
  // Get the active user
  getActiveUser(): User {
    // Find the user object by ID
    const user = this.users.find(u => u.id === this.activeDropdown);
    if (!user) {
      console.error('Active user not found:', this.activeDropdown);
      return {} as User; // Return empty user as fallback
    }
    return user;
  }
  
  addNewUser(): void {
    // Create an empty user object with default values
    const newUser = {
      id: 0, // Will be assigned by the backend
      firstName: '',
      lastName: '',
      email: '',
      role: 'ROLE_USER', // Default role
      team: 'DEV', // Default team
      active: true
    } as User;
    
    // Use the team color system for consistency
    const teamColor = this.getTeamColor(newUser.team);
    
    // Create a dynamic HTML with enhanced interactive elements for the new user form
    const dynamicHtml = `
      <div class="user-edit-container" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 5px;">
        <!-- Header with icon -->
        <div style="text-align: center; margin-bottom: 18px;">
          <div style="width: 60px; height: 60px; margin: 0 auto 12px; background-color: #3B82F620; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <i class="bi bi-person-plus" style="font-size: 24px; color: #3B82F6;"></i>
          </div>
          <h3 style="font-size: 18px; margin-bottom: 5px; color: #1F2937;">Nouvel utilisateur</h3>
          <div style="font-size: 13px; color: #6B7280;">Créer un nouvel utilisateur</div>
        </div>
        
        <form id="edit-user-form" class="swal-form" style="border-top: 1px solid rgba(59, 130, 246, 0.1); padding: 22px 15px 15px; position: relative; max-width: 450px; margin: 0 auto;">
          <!-- Two-column layout for name fields -->
          <div style="display: flex; gap: 12px; margin-bottom: 18px;">
            <div class="form-group" style="position: relative; flex: 1;">
              <label for="firstName" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Prénom</label>
              <div style="position: relative;">
                <input type="text" id="firstName" class="swal2-input" placeholder="Prénom" 
                     style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <i class="bi bi-person" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
              </div>
            </div>
            <div class="form-group" style="position: relative; flex: 1;">
              <label for="lastName" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Nom</label>
              <div style="position: relative;">
                <input type="text" id="lastName" class="swal2-input" placeholder="Nom" 
                     style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <i class="bi bi-person" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
              </div>
            </div>
          </div>
          
          <!-- Email field (full width) -->
          <div class="form-group" style="position: relative; margin-bottom: 18px;">
            <label for="email" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Email</label>
            <div style="position: relative;">
              <input type="email" id="email" class="swal2-input" placeholder="Email" 
                   style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <i class="bi bi-envelope" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
            </div>
          </div>
          
          <!-- Password field (full width) -->
          <div class="form-group" style="position: relative; margin-bottom: 18px;">
            <label for="password" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Mot de passe</label>
            <div style="position: relative;">
              <input type="password" id="password" class="swal2-input" placeholder="Mot de passe" 
                   style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <i class="bi bi-shield-lock" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
            </div>
          </div>
          
          <!-- Two-column layout for role and team fields -->
          <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <div class="form-group" style="position: relative; flex: 1;">
              <label for="role" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Rôle</label>
              <div style="position: relative;">
                <select id="role" class="swal2-input" style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); appearance: none;">
                  ${this.roles.map(role => `
                    <option value="${role}" ${newUser.role === role ? 'selected' : ''}>${role}</option>
                  `).join('')}
                </select>
                <i class="bi bi-shield" style="position: absolute; right: 25px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
                <i class="bi bi-chevron-down" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 11px; opacity: 0.6;"></i>
              </div>
            </div>
            <div class="form-group" style="position: relative; flex: 1;">
              <label for="team" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Équipe</label>
              <div style="position: relative;">
                <select id="team" class="swal2-input" style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); appearance: none;">
                  ${this.teams.map(team => `
                    <option value="${team}" ${newUser.team === team ? 'selected' : ''}>${team}</option>
                  `).join('')}
                </select>
                <i class="bi bi-people" style="position: absolute; right: 25px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
                <i class="bi bi-chevron-down" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 11px; opacity: 0.6;"></i>
              </div>
            </div>
          </div>
          
          <!-- Optional helper text -->
          <div style="text-align: center; margin-top: 20px;">
            <span style="font-size: 11px; color: #9CA3AF; font-style: italic;">Le mot de passe doit contenir au moins 6 caractères</span>
          </div>
        </form>
      </div>
    `;
    
    // Show the add user form with SweetAlert
    Swal.fire({
      title: 'Ajouter un utilisateur',
      html: dynamicHtml,
      showCancelButton: true,
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Créer',
      cancelButtonText: 'Annuler',
      customClass: {
        popup: 'large-form-popup',
        title: 'form-title',
        htmlContainer: 'form-content',
        actions: 'form-actions',
        confirmButton: 'form-confirm-button',
        cancelButton: 'form-cancel-button'
      },
      backdrop: 'rgba(0,0,0,0.4)',
      preConfirm: () => {
        // Get form values
        const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
        const lastName = (document.getElementById('lastName') as HTMLInputElement).value;
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;
        const role = (document.getElementById('role') as HTMLSelectElement).value;
        const team = (document.getElementById('team') as HTMLSelectElement).value;
        
        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
          Swal.showValidationMessage('Veuillez remplir tous les champs obligatoires');
          return false;
        }
        
        // Validate email format
        if (!this.validateEmail(email)) {
          Swal.showValidationMessage('Format d\'email invalide');
          return false;
        }
        
        // Validate password length
        if (password.length < 6) {
          Swal.showValidationMessage('Le mot de passe doit contenir au moins 6 caractères');
          return false;
        }
        
        // Return the new user data including password
        return { firstName, lastName, email, password, role, team };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        // Create the registration object matching the auth/register endpoint format
        const newUser = {
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          email: result.value.email,
          password: result.value.password,
          role: result.value.role,
          team: result.value.team
        };
        
        // Register the new user using the auth endpoint
        this.userService.registerUser(newUser).subscribe({
          next: (createdUser) => {
            this.showSuccessMessage('Utilisateur créé avec succès');
            this.refreshUserData(); // Refresh the user list
          },
          error: (error) => {
            console.error('Error creating user:', error);
            this.showErrorMessage('Erreur lors de la création de l\'utilisateur');
          }
        });
      }
    });
  }
  
  // Validate email format
  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  modifyUser(user: User): void {
    if (!user) return;
    
    const modifyColor = '#F59E0B'; // Orange color for modify
    const teamColor = this.getTeamColor(user.team);
    
    // Get avatar HTML using the consistent method
    const avatarHtml = this.getAvatarHtml(user, 60);
    
    // Create a dynamic HTML with enhanced interactive elements and visual feedback
    const dynamicHtml = `
      <div class="user-edit-container" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 5px;">
        <!-- Cleaner avatar container with subtle effect -->
        <div class="avatar-container" style="position: relative; width: 76px; height: 76px; margin-bottom: 18px;">
          <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;">
            ${avatarHtml}
          </div>
          <div class="action-overlay" id="actionOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0;
                background-color: rgba(245, 158, 11, 0.2);">
            <i class="bi bi-pencil-square" style="color: ${modifyColor}; font-size: 18px;"></i>
          </div>
          <!-- Small decoration dot -->
          <div style="position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; border-radius: 50%; 
                    background: linear-gradient(135deg, ${modifyColor}, #FBBF24); border: 2px solid white;"></div>
        </div>
        
        <!-- Refined user details with improved typography -->
        <div style="text-align: center; margin-bottom: 8px;">
          <div class="user-name" id="userNameDisplay" style="font-weight: 600; font-size: 18px; margin-bottom: 3px; color: #1F2937;">${user.firstName} ${user.lastName}</div>
          <div class="user-email" id="userEmailDisplay" style="font-size: 13px; color: #6B7280; margin-bottom: 8px;">${user.email}</div>
          <div class="team-badge" style="display: inline-block; font-size: 11px; padding: 3px 10px; 
               border-radius: 12px; background-color: ${teamColor}10; color: ${teamColor}; font-weight: 500;
               box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
            <span id="teamDisplay">${user.team}</span>
          </div>
        </div>
      </div>
      
      <form id="edit-user-form" class="swal-form" style="border-top: 1px solid rgba(245, 158, 11, 0.1); padding: 22px 15px 15px; position: relative; max-width: 450px; margin: 0 auto;">
        <!-- Form header with simple instruction -->
        <div style="margin-bottom: 22px; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #9CA3AF; font-weight: 500;">Modifier les informations</span>
        </div>
        
        <!-- Two-column layout for name fields -->
        <div style="display: flex; gap: 12px; margin-bottom: 18px;">
          <div class="form-group" style="position: relative; flex: 1;">
            <label for="firstName" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Prénom</label>
            <div style="position: relative;">
              <input type="text" id="firstName" class="swal2-input" value="${user.firstName || ''}" placeholder="Prénom" 
                   style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <i class="bi bi-person" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
            </div>
          </div>
          <div class="form-group" style="position: relative; flex: 1;">
            <label for="lastName" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Nom</label>
            <div style="position: relative;">
              <input type="text" id="lastName" class="swal2-input" value="${user.lastName || ''}" placeholder="Nom" 
                   style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <i class="bi bi-person" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
            </div>
          </div>
        </div>
        
        <!-- Email field (full width) -->
        <div class="form-group" style="position: relative; margin-bottom: 18px;">
          <label for="email" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Email</label>
          <div style="position: relative;">
            <input type="email" id="email" class="swal2-input" value="${user.email || ''}" placeholder="Email" 
                 style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <i class="bi bi-envelope" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
          </div>
        </div>
        
        <!-- Two-column layout for role and team fields -->
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div class="form-group" style="position: relative; flex: 1;">
            <label for="role" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Rôle</label>
            <div style="position: relative;">
              <select id="role" class="swal2-input" style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); appearance: none;">
                ${this.roles.map(role => `
                  <option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>
                `).join('')}
              </select>
              <i class="bi bi-shield" style="position: absolute; right: 25px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
              <i class="bi bi-chevron-down" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 11px; opacity: 0.6;"></i>
            </div>
          </div>
          <div class="form-group" style="position: relative; flex: 1;">
            <label for="team" style="display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 500;">Équipe</label>
            <div style="position: relative;">
              <select id="team" class="swal2-input" style="height: 34px; font-size: 13px; margin: 0; width: 100%; padding: 0 30px 0 10px; border-radius: 4px; border-color: #F5F5F5; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); appearance: none;">
                ${this.teams.map(team => `
                  <option value="${team}" ${user.team === team ? 'selected' : ''}>${team}</option>
                `).join('')}
              </select>
              <i class="bi bi-people" style="position: absolute; right: 25px; top: 9px; color: #CBD5E0; font-size: 14px;"></i>
              <i class="bi bi-chevron-down" style="position: absolute; right: 10px; top: 9px; color: #CBD5E0; font-size: 11px; opacity: 0.6;"></i>
            </div>
          </div>
        </div>
        
        <!-- Optional helper text -->
        <div style="text-align: center; margin-top: 20px;">
          <span style="font-size: 11px; color: #9CA3AF; font-style: italic;">Les modifications seront appliquées immédiatement</span>
        </div>
      </form>
    `;
    
    // Create a SweetAlert form for editing user details with orange theme
    Swal.fire({
      title: 'Modifier l\'utilisateur',
      html: dynamicHtml,
      showCancelButton: true,
      confirmButtonColor: modifyColor,
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Enregistrer',
      cancelButtonText: 'Annuler',
      focusConfirm: false,
      customClass: {
        container: 'edit-user-container',
        popup: 'edit-user-popup',
        htmlContainer: 'edit-user-content'
      },
      didOpen: (modal) => {
        // Add hover effect to the avatar
        const container = modal.querySelector('.avatar-container');
        const overlay = modal.querySelector('#actionOverlay') as HTMLElement;
        
        // Initialize elements for live preview
        const nameDisplay = modal.querySelector('#userNameDisplay') as HTMLElement;
        const emailDisplay = modal.querySelector('#userEmailDisplay') as HTMLElement;
        const teamDisplay = modal.querySelector('#teamDisplay') as HTMLElement;
        
        // Get input elements
        const firstNameInput = modal.querySelector('#firstName') as HTMLInputElement;
        const lastNameInput = modal.querySelector('#lastName') as HTMLInputElement;
        const emailInput = modal.querySelector('#email') as HTMLInputElement;
        const teamSelect = modal.querySelector('#team') as HTMLSelectElement;
        
        // Add focus effects to inputs with orange highlight
        const inputs = modal.querySelectorAll('.swal2-input');
        inputs.forEach((input) => {
          const inputElement = input as HTMLElement;
          // Add focus effect
          inputElement.addEventListener('focus', () => {
            inputElement.style.borderColor = `${modifyColor}`;
            inputElement.style.boxShadow = `0 0 0 1px ${modifyColor}30`;
            
            // Find the icon next to this input
            const parent = inputElement.parentElement;
            if (parent) {
              const icon = parent.querySelector('i');
              if (icon) {
                const iconElement = icon as HTMLElement;
                iconElement.style.color = modifyColor;
              }
            }
          });
          
          // Remove focus effect
          inputElement.addEventListener('blur', () => {
            inputElement.style.borderColor = '#F5F5F5';
            inputElement.style.boxShadow = 'none';
            
            // Reset icon color
            const parent = inputElement.parentElement;
            if (parent) {
              const icon = parent.querySelector('i');
              if (icon) {
                const iconElement = icon as HTMLElement;
                iconElement.style.color = '#CBD5E0';
              }
            }
          });
          
          // Add subtle transform on focus
          inputElement.addEventListener('focus', () => {
            inputElement.style.transform = 'translateY(-1px)';
          });
          
          inputElement.addEventListener('blur', () => {
            inputElement.style.transform = 'translateY(0)';
          });
        });
        
        // Live preview of changes
        if (firstNameInput && lastNameInput && nameDisplay) {
          const firstNameElement = firstNameInput as HTMLInputElement;
          const lastNameElement = lastNameInput as HTMLInputElement;
          
          const updateName = () => {
            nameDisplay.textContent = `${firstNameElement.value} ${lastNameElement.value}`;
          };
          
          firstNameElement.addEventListener('input', updateName);
          lastNameElement.addEventListener('input', updateName);
        }
        
        if (emailInput && emailDisplay) {
          const emailElement = emailInput as HTMLInputElement;
          emailElement.addEventListener('input', () => {
            emailDisplay.textContent = emailElement.value;
          });
        }
        
        if (teamSelect && teamDisplay) {
          const teamSelectElement = teamSelect as HTMLSelectElement;
          teamSelectElement.addEventListener('change', () => {
            teamDisplay.textContent = teamSelectElement.value;
            
            // Update team badge color based on selected team
            const newTeamColor = this.getTeamColor(teamSelectElement.value);
            const teamBadge = modal.querySelector('.team-badge') as HTMLElement;
            if (teamBadge) {
              teamBadge.style.backgroundColor = `${newTeamColor}20`;
              teamBadge.style.color = newTeamColor;
            }
          });
        }
        
        // Avatar hover effects with subtle pulse
        if (container && overlay) {
          // Add mouse hover effects
          container.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
            overlay.style.transition = 'opacity 0.3s ease';
          });
          
          container.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
          });
          
          // Add a subtle animation that pulses the pencil icon every few seconds
          let pulse = true;
          const pulseAnimation = setInterval(() => {
            if (pulse && overlay.style.opacity !== '1') {
              overlay.style.opacity = '0.6';
              overlay.style.transform = 'scale(1.05)';
              setTimeout(() => {
                if (overlay.style.opacity !== '1') {
                  overlay.style.opacity = '0';
                  overlay.style.transform = 'scale(1)';
                }
              }, 700);
            }
          }, 3000);
          
          // Clean up the interval when dialog closes
          const popup = Swal.getPopup();
          if (popup) {
            popup.addEventListener('click', () => {
              pulse = false;
              clearInterval(pulseAnimation);
            });
          }
        }
      },
      preConfirm: () => {
        // Get values from form
        const formValues = {
          firstName: (document.getElementById('firstName') as HTMLInputElement).value,
          lastName: (document.getElementById('lastName') as HTMLInputElement).value,
          email: (document.getElementById('email') as HTMLInputElement).value,
          role: (document.getElementById('role') as HTMLSelectElement).value,
          team: (document.getElementById('team') as HTMLSelectElement).value
        };
        
        // Validate form values
        if (!formValues.firstName || !formValues.lastName || !formValues.email) {
          Swal.showValidationMessage('Veuillez remplir tous les champs obligatoires');
          return false;
        }
        
        // Email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(formValues.email)) {
          Swal.showValidationMessage('Veuillez entrer une adresse email valide');
          return false;
        }
        
        return formValues;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        // Create user request object
        // Note: We're not including password in the request, making it an optional field
        const userRequest: UserRequest = {
          email: result.value.email,
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          role: result.value.role,
          team: result.value.team,
          password: undefined // Explicitly set to undefined so it's not included in the request
        };
        
        this.loading = true;
        
        // Call the API to update the user
        this.userService.updateUser(user.id, userRequest).subscribe({
          next: (updatedUser) => {
            // Update user in local arrays
            const index = this.users.findIndex(u => u.id === user.id);
            if (index !== -1) {
              this.users[index] = {
                ...this.users[index],
                ...updatedUser,
                employeeName: `${updatedUser.firstName} ${updatedUser.lastName}`
              };
            }
            
            // Update filtered users
            const filteredIndex = this.filteredUsers.findIndex(u => u.id === user.id);
            if (filteredIndex !== -1) {
              this.filteredUsers[filteredIndex] = {
                ...this.filteredUsers[filteredIndex],
                ...updatedUser,
                employeeName: `${updatedUser.firstName} ${updatedUser.lastName}`
              };
            }
            
            // Show a modern toast notification for user modification
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2000,
              timerProgressBar: true,
              showClass: {
                popup: 'animate__animated animate__fadeInRight animate__faster'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOutRight animate__faster'
              },
              customClass: {
                popup: 'modern-toast-popup success-toast',
                title: 'modern-toast-title',
                htmlContainer: 'toast-container'
              }
            });
            
            // Get user information for the toast
            const userName = `${updatedUser.firstName} ${updatedUser.lastName.charAt(0)}.`;
            
            // Fire the toast with modern styling
            Toast.fire({
              title: ' ', // Need a space to ensure SweetAlert renders properly
              html: `<div class="toast-content"><i class="bi bi-check-circle-fill toast-icon success"></i>${userName} modifié avec succès</div>`
            });
            
            // Update pagination
            this.updatePagination();
            this.loading = false;
          },
          error: (err) => {
            // Show modern error toast
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
              showClass: {
                popup: 'animate__animated animate__fadeInRight animate__faster'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOutRight animate__faster'
              },
              customClass: {
                popup: 'modern-toast-popup error-toast',
                title: 'modern-toast-title',
                htmlContainer: 'toast-container'
              }
            });
            
            // Fire the toast with error message
            Toast.fire({
              title: ' ',
              html: `<div class="toast-content"><i class="bi bi-exclamation-circle-fill toast-icon error"></i>Erreur lors de la modification</div>`
            });
            
            this.loading = false;
            console.error('Update user error:', err);
          }
        });
      }
    });
  }
  
  toggleBlockUser(user: User): void {
    this.activeDropdown = null;
    
    // Get the profile photo or use initials as fallback
    const userInitials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
    const teamColor = this.getTeamColor(user.team);
    const hasProfilePhoto = this.userProfilePhotos.has(user.id);
    
    // Create HTML for avatar - either photo or colored initials
    let avatarHtml = '';
    if (hasProfilePhoto) {
      // Use profile photo if available
      const photoUrl = this.userProfilePhotos.get(user.id);
      avatarHtml = `
        <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden;">
          <img src="${photoUrl}" alt="${user.firstName}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `;
    } else {
      // Use colored initials as fallback
      avatarHtml = `
        <div style="width: 60px; height: 60px; border-radius: 50%; background-color: ${teamColor}; 
                    display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: 600; font-size: 18px;">${userInitials}</span>
        </div>
      `;
    }
    
    // Determine action based on current block status
    const isBlocking = !user.blocked;
    const actionText = isBlocking ? 'Bloquer' : 'Débloquer';
    const actionColor = isBlocking ? '#3B82F6' : '#10B981';
    
    // Prepare a more interactive confirmation dialog
    const avatarSize = 52;
    const confirmAnimation = isBlocking ? 'lockAnimation' : 'unlockAnimation';
    
    // Create a dynamic HTML with animated avatars and interactive elements
    const dynamicHtml = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="width: ${avatarSize}px; height: ${avatarSize}px; margin-bottom: 16px;">
          ${avatarHtml}
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 10px; ${isBlocking ? 'color: #EF4444;' : ''}">
            ${isBlocking ? 'Bloquer' : 'Débloquer'} <span style="color: ${actionColor}">${user.firstName} ${user.lastName}</span>?
          </div>
          <div style="font-size: 13px; color: #6B7280; margin-bottom: 10px;">
            ${user.email}
          </div>
          <div class="team-badge" style="display: inline-block; font-size: 9px; padding: 2px 6px; 
               border-radius: 4px; background-color: ${teamColor}20; color: ${teamColor}; font-weight: 500;">
            <span>${user.team}</span>
          </div>
        </div>
      </div>
    `;
    
    // Confirm block/unblock with enhanced interactive SweetAlert
    Swal.fire({
      title: `${actionText} l'utilisateur?`,
      html: dynamicHtml,
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: '#6B7280',
      confirmButtonText: actionText,
      cancelButtonText: 'Annuler',
      customClass: {
        popup: 'small-confirm-popup',
        title: 'small-confirm-title',
        htmlContainer: 'small-confirm-content',
        actions: 'small-confirm-actions',
        confirmButton: 'small-confirm-button',
        cancelButton: 'small-cancel-button'
      },
      didOpen: (modal) => {
        // Add hover effect to the avatar
        const container = modal.querySelector('.avatar-container');
        const overlay = modal.querySelector('#actionOverlay') as HTMLElement;
        
        if (container && overlay) {
          // Add mouse hover effects
          container.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
            overlay.style.transition = 'opacity 0.3s ease';
          });
          
          container.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
          });
          
          // Start a subtle animation
          let pulse = true;
          const pulseAnimation = setInterval(() => {
            if (pulse) {
              overlay.style.opacity = '0.6';
              setTimeout(() => {
                overlay.style.opacity = '0';
              }, 600);
            }
          }, 1500);
          
          // Clean up the interval when dialog closes
          const popup = Swal.getPopup();
          if (popup) {
            popup.addEventListener('click', () => {
              pulse = false;
              clearInterval(pulseAnimation);
            });
          }
        }
      },
      showClass: {
        popup: 'animate__animated animate__fadeIn animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut animate__faster'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // Toggle the blocked status
        user.blocked = !user.blocked;
        
        // Show a modern toast notification for block/unblock action
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          showClass: {
            popup: 'animate__animated animate__fadeInRight animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutRight animate__faster'
          },
          customClass: {
            popup: `modern-toast-popup ${user.blocked ? 'warning-toast' : 'success-toast'}`,
            title: 'modern-toast-title',
            htmlContainer: 'toast-container'
          }
        });
        
        // Get user information for the toast
        const userName = `${user.firstName} ${user.lastName.charAt(0)}.`;
        const actionText = user.blocked ? 'bloqué' : 'débloqué';
        const iconClass = user.blocked ? 'bi-shield-lock-fill toast-icon warning' : 'bi-unlock-fill toast-icon success';
        
        // Fire the toast with modern styling
        Toast.fire({
          title: ' ', // Need a space to ensure SweetAlert renders properly
          html: `<div class="toast-content"><i class="bi ${iconClass}"></i>${userName} ${actionText}</div>`
        });
        
        console.log(user.blocked ? 'User blocked:' : 'User unblocked:', user);
      }
    });
  }
  
  deleteUser(user: User): void {
    console.log('Delete user:', user);
    this.activeDropdown = null;
    
    // Get avatar HTML using the consistent method
    const avatarHtml = this.getAvatarHtml(user, 60);
    
    // Prepare a more interactive confirmation dialog for deletion
    const avatarSize = 52;
    const teamColor = this.getTeamColor(user.team);
    
    // Create a dynamic HTML with animated avatars and interactive elements
    const dynamicHtml = `
      <div id="userActionContainer" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div class="avatar-container" style="position: relative; width: ${avatarSize}px; height: ${avatarSize}px; margin-bottom: 15px;">
          ${avatarHtml}
          <div class="action-overlay" id="actionOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0;
                background-color: rgba(220, 38, 38, 0.2);">
            <i class="bi bi-trash" style="color: #DC2626; font-size: 20px;"></i>
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 10px;">
          <div class="user-name" style="font-weight: 600; font-size: 16px; margin-bottom: 2px;">${user.firstName} ${user.lastName}</div>
          <div class="user-email" style="font-size: 12px; color: #6B7280;">${user.email}</div>
          <div class="team-badge" style="display: inline-block; font-size: 9px; margin-top: 5px; padding: 2px 6px; 
               border-radius: 4px; background-color: ${teamColor}20; color: ${teamColor}; font-weight: 500;">
            ${user.team}
          </div>
        </div>
        <div class="action-message" style="font-size: 12px; color: #6B7280; margin-top: 5px; text-align: center;">
          Cette action supprimera définitivement l'utilisateur. Cette opération ne peut pas être annulée.
        </div>
      </div>
    `;
    
    // Confirm deletion with enhanced interactive SweetAlert
    Swal.fire({
      title: 'Supprimer l\'utilisateur?',
      html: dynamicHtml,
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      customClass: {
        popup: 'small-confirm-popup',
        title: 'small-confirm-title',
        htmlContainer: 'small-confirm-content',
        actions: 'small-confirm-actions',
        confirmButton: 'small-confirm-button',
        cancelButton: 'small-cancel-button'
      },
      backdrop: 'rgba(0,0,0,0.4)',
      didOpen: (modal) => {
        // Add hover effect to the avatar
        const container = modal.querySelector('.avatar-container');
        const overlay = modal.querySelector('#actionOverlay') as HTMLElement;
        
        if (container && overlay) {
          // Add mouse hover effects
          container.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
            overlay.style.transition = 'opacity 0.3s ease';
          });
          
          container.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
          });
          
          // Start a subtle animation - pulsing trash icon
          let pulse = true;
          const pulseAnimation = setInterval(() => {
            if (pulse) {
              overlay.style.opacity = '0.6';
              setTimeout(() => {
                overlay.style.opacity = '0';
              }, 600);
            }
          }, 1500);
          
          // Clean up the interval when dialog closes
          const popup = Swal.getPopup();
          if (popup) {
            popup.addEventListener('click', () => {
              pulse = false;
              clearInterval(pulseAnimation);
            });
          }
        }
      },
      showClass: {
        popup: 'animate__animated animate__fadeIn animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut animate__faster'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        
        // Show loading state
        const loadingToast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          didOpen: (toast) => {
            Swal.showLoading();
            const htmlContainer = Swal.getHtmlContainer();
            if (htmlContainer) {
              const loader = htmlContainer.querySelector('div');
              if (loader) {
                loader.textContent = 'Suppression en cours...';
                loader.style.padding = '0.5em';
              }
            }
          }
        });
        
        loadingToast.fire();
        
        // Call API to delete user
        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            // Store user info for the toast message before removing from array
            const userName = `${user.firstName} ${user.lastName.charAt(0)}.`;
            
            // Remove user from the list and immediately filter the filtered list too
            this.users = this.users.filter(u => u.id !== user.id);
            this.filteredUsers = this.filteredUsers.filter(u => u.id !== user.id);
            
            // Close loading toast
            Swal.close();
            
            // Show a modern toast notification for user deletion
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2000,
              timerProgressBar: true,
              showClass: {
                popup: 'animate__animated animate__fadeInRight animate__faster'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOutRight animate__faster'
              },
              customClass: {
                popup: 'modern-toast-popup success-toast',
                title: 'modern-toast-title',
                htmlContainer: 'toast-container'
              }
            });
            
            // Fire the toast with modern styling
            Toast.fire({
              title: ' ', // Need a space to ensure SweetAlert renders properly
              html: `<div class="toast-content"><i class="bi bi-check-circle-fill toast-icon success"></i>${userName} supprimé avec succès</div>`
            });
            
            // Apply subtle row removal animation
            const row = document.querySelector(`tr[data-user-id="${user.id}"]`);
            if (row) {
              row.classList.add('row-fade-out');
              setTimeout(() => {
                row.remove();
              }, 300);
            }
            
            // Update pagination
            this.updatePagination();
            
            this.loading = false;
          },
          error: (err) => {
            // Close loading toast
            Swal.close();
            
            // Show modern error toast for deletion failure
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
              showClass: {
                popup: 'animate__animated animate__fadeInRight animate__faster'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOutRight animate__faster'
              },
              customClass: {
                popup: 'modern-toast-popup error-toast',
                title: 'modern-toast-title',
                htmlContainer: 'toast-container'
              }
            });
            
            // Fire the toast with error message
            Toast.fire({
              title: ' ',
              html: `<div class="toast-content"><i class="bi bi-exclamation-circle-fill toast-icon error"></i>Erreur lors de la suppression</div>`
            });
            
            console.error('Delete user error:', err);
            this.loading = false;
            console.error('Delete user error:', err);
          }
        });
      }
    });
  }
  
  // Helper function to get team color
  private getTeamColor(team: string): string {
    switch(team) {
      case 'DEV': return '#3B82F6'; // Blue
      case 'QA': return '#16A34A';  // Green
      case 'OPS': return '#0369A1'; // Dark blue
      default: return '#7E22CE';    // Purple for other teams/RH
    }
  }
  
  /**
   * Generate consistent avatar HTML for both profile photos and initials fallback
   * @param user The user to generate the avatar for
   * @param size The size of the avatar in pixels
   * @returns HTML string for the avatar
   */
  getAvatarHtml(user: User, size: number = 60): string {
    const userInitials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
    const teamColor = this.getTeamColor(user.team);
    const hasProfilePhoto = this.userProfilePhotos.has(user.id);
    
    if (hasProfilePhoto) {
      // Use profile photo if available
      const photoUrl = this.userProfilePhotos.get(user.id);
      return `
        <div style="width: ${size}px; height: ${size}px; border-radius: 50%; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <img src="${photoUrl}" alt="${user.firstName}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `;
    } else {
      // Use colored initials as fallback with consistent avatar-circle styling
      return `
        <div class="avatar-circle" style="width: ${size}px; height: ${size}px; border-radius: 50%; background-color: ${teamColor}; 
                    display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <span style="color: white; font-weight: 600; font-size: ${size/3.5}px; letter-spacing: 0.5px;">${userInitials}</span>
        </div>
      `;
    }
  }
  
  // Update pagination after filter changes or data updates
  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }
  
  // Enhanced UX Methods
  
  sortUsers(column: string, direction: 'asc' | 'desc'): void {
    this.sortColumn = column;
    this.sortDirection = direction;
    
    this.filteredUsers = [...this.filteredUsers].sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);
      
      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updatePagination();
  }
  
  getSortValue(user: User, column: string): any {
    switch(column) {
      case 'name':
        return (user.employeeName || `${user.firstName} ${user.lastName}`).toLowerCase();
      case 'email':
        return user.email.toLowerCase();
      case 'role':
        return user.role;
      case 'team':
        return user.team;
      default:
        return user.firstName.toLowerCase();
    }
  }
  
  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if already sorting by this column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to ascending for new column
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.sortUsers(this.sortColumn, this.sortDirection);
  }
  
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }
  
  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
  }
  
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  
  setupKeyboardNavigation(): void {
    // Add keyboard navigation for accessibility
    document.addEventListener('keydown', (event) => {
      if (this.activeDropdown !== null) {
        if (event.key === 'Escape') {
          this.activeDropdown = null;
        }
      }
    });
  }
  
  // This function has been moved below with enhanced functionality
  
  // Action button methods
  exportUserData(): void {
    console.log('Exporting user data...');
    
    try {
      // For Excel compatibility with French characters
      const BOM = '\uFEFF'; // UTF-8 BOM for Excel
      
      // Create Excel-compatible CSV data
      const headers = ['ID', 'Nom', 'Prénom', 'Email', 'Rôle', 'Équipe'];
      let csvContent = BOM; // Add BOM at the beginning
      
      // Add the headers
      csvContent += this.formatCSVRow(headers);
      
      // Add the data rows
      this.users.forEach(user => {
        const row = [
          user.id.toString(),
          user.lastName,
          user.firstName,
          user.email,
          user.role.replace('ROLE_', ''),
          user.team
        ];
        csvContent += this.formatCSVRow(row);
      });
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      
      // Trigger download with visible feedback
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'utilisateurs.csv';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      this.showSuccessMessage('Données utilisateurs exportées avec succès');
    } catch (error) {
      console.error('Export failed:', error);
      this.showErrorMessage('Échec de l\'export. Veuillez réessayer.');
    }
  }
  
  // Helper for CSV formatting
  private formatCSVRow(row: string[]): string {
    // Properly escape fields containing commas, quotes, etc.
    const formattedRow = row.map(field => {
      // If field contains commas, quotes, or newlines, wrap in quotes
      if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
        // Double quotes inside fields need to be escaped with another double quote
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    });
    
    return formattedRow.join(';') + '\r\n'; // Excel prefers semicolons and CRLF line endings
  }

  // Show success message with modern toast design
  showSuccessMessage(message: string, durationMs: number = 3000): void {
    // Create a modern toast notification
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: durationMs,
      timerProgressBar: true,
      showClass: {
        popup: 'animate__animated animate__fadeInRight animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutRight animate__faster'
      },
      customClass: {
        popup: 'modern-toast-popup success-toast',
        title: 'modern-toast-title',
        htmlContainer: 'toast-container'
      }
    });
    
    // Fire the toast with the success message
    Toast.fire({
      title: ' ', // Need a space to ensure SweetAlert renders properly
      html: '<div class="toast-content"><i class="bi bi-check-circle-fill toast-icon success"></i>' + message + '</div>'
    });
  }
  
  // Show error message with modern toast design
  showErrorMessage(message: string, durationMs: number = 5000): void {
    // Create a modern toast notification
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: durationMs,
      timerProgressBar: true,
      showClass: {
        popup: 'animate__animated animate__fadeInRight animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutRight animate__faster'
      },
      customClass: {
        popup: 'modern-toast-popup error-toast',
        title: 'modern-toast-title',
        htmlContainer: 'toast-container'
      }
    });
    
    // Fire the toast with the error message
    Toast.fire({
      title: ' ', // Need a space to ensure SweetAlert renders properly
      html: '<div class="toast-content"><i class="bi bi-exclamation-circle-fill toast-icon error"></i>' + message + '</div>'
    });
  }
  
  refreshUserData(): void {
    // Add a nice animation effect before refreshing
    const contentCard = document.querySelector('.content-card');
    if (contentCard) {
      contentCard.classList.add('refreshing');
      
      // Remove the class after animation completes
      setTimeout(() => {
        contentCard.classList.remove('refreshing');
      }, 600);
    }
    
    // Reload the user data
    this.loadUsers();
    this.showSuccessMessage('Données utilisateurs actualisées');
  }
  
  /**
   * Load stored profile photo from localStorage if available
   */
  loadStoredProfilePhoto(): void {
    try {
      const storedPhotoUrl = localStorage.getItem('userProfilePhoto');
      if (storedPhotoUrl && this.authService.currentUserValue) {
        // Update the profile photo in the current user object
        this.authService.currentUserValue.profilePhotoUrl = storedPhotoUrl;
        // Force UI update
        this.authService.updateCurrentUser(this.authService.currentUserValue);
        console.log('Loaded profile photo from localStorage');
      }
    } catch (e) {
      console.error('Error loading profile photo from localStorage:', e);
    }
  }
  
  logout() {
    // Close profile dropdown if open
    this.isProfileDropdownOpen = false;
    
    // Show confirmation dialog
    Swal.fire({
      title: 'Déconnexion',
      text: 'Êtes-vous sûr de vouloir vous déconnecter?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      confirmButtonText: 'Oui, déconnecter',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('Logging out user');
        // Use AuthService to properly handle logout
        this.authService.logout();
        // Navigate to login page
        this.router.navigate(['/login']);
      }
    });
  }
}
