import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../login/AuthService';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { UserService } from '../users/user.service';
import { ContactService, ContactRequest } from '../../services/contact.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reclamation-back',
  templateUrl: './reclamation-back.component.html',
  styleUrls: ['./reclamation-back.component.css'],
  providers: [DatePipe],
})
export class ReclamationBackComponent implements OnInit, OnDestroy {
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

  contactRequests: ContactRequest[] = [];
  filteredRequests: ContactRequest[] = [];
  statusFilter: string = '';
  priorityFilter: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  sortField: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedPriority: string = '';

  private priorityClassCache = new Map<string, string>();

  constructor(
    public authService: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private userService: UserService,
    private contactService: ContactService
  ) {
    this.formattedDate = this.datePipe.transform(this.today, 'dd MMMM yyyy') || '';
  }

  ngOnInit(): void {
    // Check if there's a stored profile photo URL in localStorage
    this.loadStoredProfilePhoto();
    
    // Fetch the current user's profile photo
    if (this.authService.currentUserValue?.id) {
      this.fetchUserProfilePhoto(this.authService.currentUserValue.id);
    }

    // Initialize sidebar state
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);

    this.loadRequests();
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
    // This method is likely for `teletravail-back`, keeping it for now but it might be removed later if not used.
    console.log('Loading data...');
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isSidebarOpen = window.innerWidth >= 1024;
    document.body.classList.toggle('sidebar-collapsed-layout', !this.isSidebarOpen);
  }

  /**
   * Load contact requests from the service
   */
  loadRequests(): void {
    this.isLoading = true;
    this.error = null;
    console.log('Loading contact requests...');
    this.subscriptions.add(this.contactService.getContactRequests().subscribe({
      next: (data: ContactRequest[]) => {
        console.log('Received data:', data);
        this.contactRequests = data;
        this.applyFilters(); // Apply filters after loading data
      this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading contact requests:', err);
        this.error = 'Failed to load contact requests.';
        this.isLoading = false;
      }
    }));
  }

  /**
   * Export data (placeholder)
   */
  exportData(): void {
    console.log('Exporting reclamation data...');
    
    try {
      const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility with French characters
      
      const headers = [
        'ID',
        'Nom Employé',
        'Email',
        'Sujet',
        'Message',
        'Priorité',
        'Statut',
        'Date de Création'
      ];
      let csvContent = BOM; // Add BOM at the beginning
      csvContent += this.formatCSVRow(headers);
      
      this.filteredRequests.forEach(request => {
        const row = [
          request.id?.toString() || '',
          request.employeeName || '',
          request.userEmail || '',
          request.subject || '',
          request.message || '',
          request.priority || '',
          request.status || '',
          this.datePipe.transform(request.createdAt, 'dd/MM/yyyy') || ''
        ];
        csvContent += this.formatCSVRow(row);
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'reclamations.csv';
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      Swal.fire({
        icon: 'success',
        title: 'Succès',
        text: 'Données de réclamation exportées avec succès',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error('Export failed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Échec de l\'export. Veuillez réessayer.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  }

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
   * Apply filters to contact requests
   */
  applyFilters(): void {
    console.log('Applying filters...');
    console.log('Current contactRequests:', this.contactRequests);
    console.log('Selected Priority:', this.selectedPriority);
    console.log('Selected Status:', this.statusFilter);
    let filtered = [...this.contactRequests];

    // Apply search term
    if (this.searchTerm) {
      filtered = filtered.filter(request =>
        (request.employeeName && request.employeeName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        request.subject.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (this.statusFilter) {
      console.log('Filtering by status:', this.statusFilter);
      filtered = filtered.filter(request => {
        console.log('Request status:', request.status);
        return request.status?.toLowerCase() === this.statusFilter.toLowerCase();
      });
    }

    // Apply priority filter
    if (this.selectedPriority) {
      console.log('Filtering by priority:', this.selectedPriority);
      filtered = filtered.filter(request => {
        console.log('Request priority:', request.priority);
        return request.priority?.toUpperCase() === this.selectedPriority.toUpperCase();
      });
    }

    console.log('Filtered requests:', filtered);
    this.filteredRequests = filtered;
    this.totalPages = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
  }

  onSearch(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onPriorityFilterChange(): void {
    this.applyFilters();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  get paginatedRequests(): ContactRequest[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredRequests.slice(start, start + this.itemsPerPage);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  updateStatus(request: ContactRequest, newStatus: string): void {
    const updatedRequest = { ...request, status: newStatus };
    this.contactService.updateContactRequest(request.id!, updatedRequest).subscribe({
      next: () => {
        this.loadRequests();
      },
      error: (error) => {
        console.error('Error updating contact request status:', error);
      }
    });
  }

  respondToRequest(request: ContactRequest): void {
    Swal.fire({
      title: 'Répondre à la demande',
      html: `
        <div class="response-form-container">
          <div class="request-info mb-4">
            <div class="info-header">
              <i class="bi bi-info-circle"></i>
              <span>Informations de la demande</span>
            </div>
            <div class="info-content">
              <div class="info-item">
                <label>Employé:</label>
                <span>${request.employeeName}</span>
              </div>
              <div class="info-item">
                <label>Sujet:</label>
                <span>${request.subject}</span>
              </div>
              <div class="info-item">
                <label>Priorité:</label>
                <span class="priority-badge ${this.getPriorityClass(request.priority)}">
                  ${request.priority === 'HIGH' ? 'Haute' : 
                    request.priority === 'URGENT' ? 'Urgente' : 
                    request.priority === 'NORMAL' ? 'Normale' : request.priority}
                </span>
              </div>
            </div>
          </div>

          <div class="response-section">
            <div class="mb-4">
              <label class="form-label d-flex align-items-center">
                <i class="bi bi-flag me-2"></i>
                Statut
              </label>
              <select id="responseStatus" class="form-select">
                <option value="in_progress">En cours</option>
                <option value="resolved">Résolu</option>
                <option value="rejected">Rejeté</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label d-flex align-items-center">
                <i class="bi bi-chat-left-text me-2"></i>
                Votre réponse
              </label>
              <textarea id="responseText" class="form-control" rows="4" 
                placeholder="Entrez votre réponse détaillée ici..."></textarea>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Envoyer la réponse',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      customClass: {
        container: 'response-modal-container',
        popup: 'response-modal-popup',
        title: 'response-modal-title',
        htmlContainer: 'response-modal-content',
        confirmButton: 'response-btn response-btn-primary',
        cancelButton: 'response-btn response-btn-secondary'
      },
      didOpen: () => {
        // Add custom styles
        const style = document.createElement('style');
        style.textContent = `
          .response-modal-container {
            font-family: 'Inter', sans-serif;
          }
          .response-modal-popup {
            border-radius: 12px;
            padding: 1.5rem;
          }
          .response-modal-title {
            color: #1F2937;
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
          }
          .response-modal-content {
            text-align: left;
          }
          .response-form-container .request-info {
            background-color: #F9FAFB;
            border-radius: 8px;
            padding: 1rem;
            border: 1px solid #E5E7EB;
          }
          .response-form-container .info-header {
            display: flex;
            align-items: center;
            color: #4B5563;
            font-weight: 500;
            margin-bottom: 0.75rem;
          }
          .response-form-container .info-header i {
            margin-right: 0.5rem;
            color: #3B82F6;
          }
          .response-form-container .info-content {
            display: grid;
            gap: 0.5rem;
          }
          .response-form-container .info-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .response-form-container .info-item label {
            color: #6B7280;
            font-weight: 500;
            min-width: 80px;
          }
          .response-form-container .info-item span {
            color: #1F2937;
          }
          .response-form-container .priority-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
          }
          .response-form-container .priority-high {
            background-color: #FEE2E2;
            color: #DC2626;
          }
          .response-form-container .priority-urgent {
            background-color: #FEF3C7;
            color: #D97706;
          }
          .response-form-container .priority-normal {
            background-color: #E0F2FE;
            color: #0284C7;
          }
          .response-form-container .response-section {
            background-color: white;
            border-radius: 8px;
            padding: 1rem;
          }
          .response-form-container .form-label {
            color: #4B5563;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }
          .response-form-container .form-select,
          .response-form-container .form-control {
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            padding: 0.625rem;
            transition: all 0.2s;
          }
          .response-form-container .form-select:focus,
          .response-form-container .form-control:focus {
            border-color: #3B82F6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }
          .response-form-container textarea.form-control {
            resize: vertical;
            min-height: 100px;
          }
          .response-btn {
            padding: 0.625rem 1.25rem;
            font-weight: 500;
            border-radius: 6px;
            transition: all 0.2s;
          }
          .response-btn-primary {
            background-color: #3B82F6;
            border-color: #3B82F6;
          }
          .response-btn-primary:hover {
            background-color: #2563EB;
            border-color: #2563EB;
          }
          .response-btn-secondary {
            background-color: #F3F4F6;
            border-color: #E5E7EB;
          }
          .response-btn-secondary:hover {
            background-color: #E5E7EB;
            border-color: #D1D5DB;
          }
        `;
        document.head.appendChild(style);
      },
      preConfirm: () => {
        const status = (document.getElementById('responseStatus') as HTMLSelectElement).value;
        const response = (document.getElementById('responseText') as HTMLTextAreaElement).value;
        if (!response) {
          Swal.showValidationMessage('Veuillez entrer une réponse');
          return false;
        }
        return { status, response };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const { status, response } = result.value;
        this.contactService.respondToContactRequest(request.id!, { response, status }).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire({
              icon: 'success',
              title: 'Réponse envoyée',
              text: 'La réponse a été envoyée avec succès.',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
              customClass: {
                popup: 'success-toast',
                title: 'success-toast-title',
                htmlContainer: 'success-toast-content'
              }
            });
          },
          error: (error) => {
            console.error('Error sending response:', error);
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Une erreur est survenue lors de l\'envoi de la réponse.',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
              customClass: {
                popup: 'error-toast',
                title: 'error-toast-title',
                htmlContainer: 'error-toast-content'
              }
            });
          }
        });
      }
    });
  }

  viewRequestDetails(request: ContactRequest): void {
    Swal.fire({
      title: 'Détails de la demande',
      html: `
        <div class="details-form-container">
          <div class="request-header">
            <div class="request-title">
              <h3>${request.subject}</h3>
              <span class="priority-badge ${this.getPriorityClass(request.priority)}">
                ${request.priority === 'HIGH' ? 'Haute' : 
                  request.priority === 'URGENT' ? 'Urgente' : 
                  request.priority === 'NORMAL' ? 'Normale' : request.priority}
              </span>
            </div>
            <div class="request-meta">
              <span class="date-badge">
                <i class="bi bi-calendar3"></i>
                ${this.datePipe.transform(request.createdAt, 'dd/MM/yyyy HH:mm')}
              </span>
              <span class="status-badge ${this.getStatusClass(request.status || 'pending')}">
                <i class="bi bi-circle-fill"></i>
                ${request.status || 'pending'}
              </span>
            </div>
          </div>

          <div class="request-content">
            <div class="content-section">
              <div class="section-header">
                <i class="bi bi-person"></i>
                <span>Informations de l'employé</span>
              </div>
              <div class="section-content">
                <div class="info-item">
                  <label>Nom:</label>
                  <span>${request.employeeName}</span>
                </div>
                <div class="info-item">
                  <label>Email:</label>
                  <span>${request.userEmail}</span>
                </div>
              </div>
            </div>

            <div class="content-section">
              <div class="section-header">
                <i class="bi bi-chat-left-text"></i>
                <span>Message</span>
              </div>
              <div class="section-content">
                <div class="message-content">${request.message}</div>
              </div>
            </div>

            ${request.response ? `
              <div class="content-section response-section">
                <div class="section-header">
                  <i class="bi bi-reply"></i>
                  <span>Réponse</span>
                </div>
                <div class="section-content">
                  <div class="response-content">${request.response}</div>
                  <div class="response-meta">
                    <span class="response-date">
                      <i class="bi bi-clock"></i>
                      Répondu le ${this.datePipe.transform(request.respondedAt, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `,
      confirmButtonText: 'OK',
      confirmButtonColor: '#3B82F6',
      customClass: {
        container: 'details-modal-container',
        popup: 'details-modal-popup',
        title: 'details-modal-title',
        htmlContainer: 'details-modal-content',
        confirmButton: 'details-btn details-btn-primary'
      },
      didOpen: () => {
        // Add custom styles
        const style = document.createElement('style');
        style.textContent = `
          .details-modal-container {
            font-family: 'Inter', sans-serif;
          }
          .details-modal-popup {
            border-radius: 12px;
            padding: 1rem;
            max-width: 450px;
          }
          .details-modal-title {
            color: #1F2937;
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
          }
          .details-form-container .request-header {
            background-color: #F9FAFB;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid #E5E7EB;
          }
          .details-form-container .request-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
          }
          .details-form-container .request-title h3 {
            margin: 0;
            color: #1F2937;
            font-size: 1.1rem;
            font-weight: 600;
          }
          .details-form-container .section-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background-color: #F9FAFB;
            border-bottom: 1px solid #E5E7EB;
            color: #4B5563;
            font-weight: 500;
            font-size: 0.9rem;
          }
          .details-form-container .section-content {
            padding: 0.75rem;
          }
          .details-form-container .info-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
          }
          .details-form-container .message-content,
          .details-form-container .response-content {
            color: #1F2937;
            line-height: 1.4;
            white-space: pre-wrap;
            font-size: 0.9rem;
          }
          .details-form-container .response-meta {
            margin-top: 0.75rem;
            padding-top: 0.75rem;
            border-top: 1px solid #E5E7EB;
          }
          .details-form-container .response-date {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #6B7280;
            font-size: 0.8rem;
          }
          .details-form-container .date-badge,
          .details-form-container .status-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8rem;
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
          }
          .details-form-container .priority-badge {
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 500;
          }
          .details-form-container .status-pending {
            background-color: #FEF3C7;
            color: #D97706;
          }
          .details-form-container .status-in-progress {
            background-color: #E0F2FE;
            color: #0284C7;
          }
          .details-form-container .status-resolved {
            background-color: #D1FAE5;
            color: #059669;
          }
          .details-form-container .status-rejected {
            background-color: #FEE2E2;
            color: #DC2626;
          }
          .details-form-container .request-content {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          .details-form-container .content-section {
            background-color: white;
            border-radius: 8px;
            border: 1px solid #E5E7EB;
            overflow: hidden;
          }
          .details-btn {
            padding: 0.625rem 1.25rem;
            font-weight: 500;
            border-radius: 6px;
            transition: all 0.2s;
          }
          .details-btn-primary {
            background-color: #3B82F6;
            border-color: #3B82F6;
          }
          .details-btn-primary:hover {
            background-color: #2563EB;
            border-color: #2563EB;
          }
        `;
        document.head.appendChild(style);
      }
    });
  }

  deleteRequest(id: number): void {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: "Cette action est irréversible !",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      customClass: {
        container: 'delete-modal-container',
        popup: 'delete-modal-popup',
        title: 'delete-modal-title',
        htmlContainer: 'delete-modal-content',
        confirmButton: 'delete-btn delete-btn-danger',
        cancelButton: 'delete-btn delete-btn-secondary'
      },
      didOpen: () => {
        const style = document.createElement('style');
        style.textContent = `
          .delete-modal-container {
            font-family: 'Inter', sans-serif;
          }
          .delete-modal-popup {
            border-radius: 12px;
            padding: 1.5rem;
          }
          .delete-modal-title {
            color: #1F2937;
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
          }
          .delete-modal-content {
            color: #4B5563;
            font-size: 0.875rem;
          }
          .delete-btn {
            padding: 0.625rem 1.25rem;
            font-weight: 500;
            border-radius: 6px;
            transition: all 0.2s;
          }
          .delete-btn-danger {
            background-color: #DC2626;
            border-color: #DC2626;
          }
          .delete-btn-danger:hover {
            background-color: #B91C1C;
            border-color: #B91C1C;
          }
          .delete-btn-secondary {
            background-color: #F3F4F6;
            border-color: #E5E7EB;
          }
          .delete-btn-secondary:hover {
            background-color: #E5E7EB;
            border-color: #D1D5DB;
          }
        `;
        document.head.appendChild(style);
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.contactService.deleteContactRequest(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire({
              icon: 'success',
              title: 'Supprimé !',
              text: 'La réclamation a été supprimée avec succès.',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
              customClass: {
                popup: 'success-toast',
                title: 'success-toast-title',
                htmlContainer: 'success-toast-content'
              }
            });
          },
          error: (error) => {
            console.error('Error deleting request:', error);
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Une erreur est survenue lors de la suppression.',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
              customClass: {
                popup: 'error-toast',
                title: 'error-toast-title',
                htmlContainer: 'error-toast-content'
              }
            });
          }
        });
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'status-pending';
      case 'in_progress':
        return 'status-in-progress';
      case 'resolved':
        return 'status-resolved';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  }

  getPriorityClass(priority: string): string {
    if (this.priorityClassCache.has(priority)) {
      return this.priorityClassCache.get(priority)!;
    }

    let className = '';
    switch (priority) {
      case 'HIGH':
        className = 'priority-high';
        break;
      case 'URGENT':
        className = 'priority-urgent';
        break;
      case 'NORMAL':
        className = 'priority-normal';
        break;
      default:
        className = 'priority-normal';
    }

    this.priorityClassCache.set(priority, className);
    return className;
  }
}
