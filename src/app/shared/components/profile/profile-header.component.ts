import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../../../login/AuthService';
import { ProfileService } from '../../../services/profile.service';
import { PasswordResetService } from '../../../services/password-reset.service';
import { SoundService } from '../../../services/sound.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-profile-header',
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.css']
})
export class ProfileHeaderComponent implements OnInit {
  isProfilePopupOpen: boolean = false;
  profilePhotoUrl: string | null = null;
  currentUser: any = null;
  isUploadingPhoto: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private passwordResetService: PasswordResetService,
    private soundService: SoundService
  ) {}

  ngOnInit(): void {
    // Subscribe to the current user from AuthService
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.currentUser = user;
        // Fetch profile photo if user has an ID
        if (user.id) {
          this.fetchProfilePhoto(user.id);
        }
      }
    });
  }

  /**
   * Toggles the profile popup visibility
   */
  toggleProfilePopup(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isProfilePopupOpen = !this.isProfilePopupOpen;

    // Add click outside listener when popup is opened
    if (this.isProfilePopupOpen) {
      setTimeout(() => {
        document.addEventListener('click', this.closePopupOnClickOutside);
      }, 0);
    }
  }

  /**
   * Closes the profile popup
   */
  closeProfilePopup(): void {
    this.isProfilePopupOpen = false;
    document.removeEventListener('click', this.closePopupOnClickOutside);
  }

  /**
   * Handle password reset request
   */
  handlePasswordReset(): void {
    if (!this.currentUser?.email) {
      Swal.fire({
        title: 'Erreur',
        text: 'Impossible de trouver votre email.',
        icon: 'error',
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 3000,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '0.5em',
        customClass: {
          popup: 'small-toast',
          title: 'small-toast-title',
          htmlContainer: 'small-toast-content'
        }
      });
      return;
    }

    this.passwordResetService.requestPasswordReset(this.currentUser.email).subscribe({
      next: () => {
        // Play success sound
        this.soundService.playSuccess();

        // Show success message
        Swal.fire({
          title: 'Email envoyé',
          text: 'Un email avec un lien de réinitialisation a été envoyé à votre adresse.',
          icon: 'success',
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.5em',
          customClass: {
            popup: 'small-toast',
            title: 'small-toast-title',
            htmlContainer: 'small-toast-content'
          }
        });

        // Automatically logout after 5 seconds
        setTimeout(() => {
          this.authService.logout();
        }, 5000);
      },
      error: (error) => {
        console.error('Error requesting password reset:', error);
        Swal.fire({
          title: 'Erreur',
          text: 'Impossible d\'envoyer l\'email de réinitialisation. Veuillez réessayer plus tard.',
          icon: 'error',
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.5em',
          customClass: {
            popup: 'small-toast',
            title: 'small-toast-title',
            htmlContainer: 'small-toast-content'
          }
        });
      }
    });
  }

  /**
   * Closes the popup when clicking outside
   */
  closePopupOnClickOutside = (event: any): void => {
    const popup = document.querySelector('.profile-popup');
    const profileIcon = document.querySelector('.user-profile');
    
    if (popup && !popup.contains(event.target) && profileIcon && !profileIcon.contains(event.target)) {
      this.closeProfilePopup();
    }
  }

  /**
   * Handles file selection for profile photo upload
   * @param event The file input change event
   */
  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length > 0) {
      const file = element.files[0];
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        Swal.fire({
          title: 'Type de fichier non valide',
          text: 'Veuillez sélectionner une image au format JPG ou PNG.',
          icon: 'error',
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.5em',
          customClass: {
            popup: 'small-toast',
            title: 'small-toast-title',
            htmlContainer: 'small-toast-content'
          }
        });
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        Swal.fire({
          title: 'Fichier trop volumineux',
          text: 'La taille du fichier ne doit pas dépasser 5 MB.',
          icon: 'error',
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.5em',
          customClass: {
            popup: 'small-toast',
            title: 'small-toast-title',
            htmlContainer: 'small-toast-content'
          }
        });
        return;
      }
      
      // Upload the file
      this.isUploadingPhoto = true;
      
      if (this.currentUser && this.currentUser.id) {
        this.profileService.uploadProfilePhoto(this.currentUser.id, file).subscribe({
          next: (response) => {
            // Play success sound
            this.soundService.playSuccess();

            // Refresh the profile photo
            this.fetchProfilePhoto(this.currentUser.id);
            this.isUploadingPhoto = false;
            
            // Show success message
            Swal.fire({
              title: 'Photo mise à jour',
              text: 'Votre photo de profil a été mise à jour avec succès.',
              icon: 'success',
              toast: true,
              position: 'bottom-end',
              showConfirmButton: false,
              timer: 3000,
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '0.5em',
              customClass: {
                popup: 'small-toast',
                title: 'small-toast-title',
                htmlContainer: 'small-toast-content'
              }
            });
          },
          error: (error) => {
            console.error('Error uploading profile photo:', error);
            this.soundService.playWarning();
            this.isUploadingPhoto = false;
            
            // Show error message
            Swal.fire({
              title: 'Erreur',
              text: 'Impossible de mettre à jour votre photo de profil. Veuillez réessayer plus tard.',
              icon: 'error',
              toast: true,
              position: 'bottom-end',
              showConfirmButton: false,
              timer: 3000,
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '0.5em',
              customClass: {
                popup: 'small-toast',
                title: 'small-toast-title',
                htmlContainer: 'small-toast-content'
              }
            });
          }
        });
      } else {
        this.isUploadingPhoto = false;
        console.error('Cannot upload photo: No user ID available');
      }
    }
  }

  /**
   * Fetches the user's profile photo from the server
   * @param userId The ID of the user
   */
  private fetchProfilePhoto(userId: number): void {
    this.profileService.getUserProfilePhoto(userId).subscribe({
      next: (response: { photoUrl: string }) => {
        if (response && response.photoUrl) {
          this.profilePhotoUrl = response.photoUrl;
        }
      },
      error: (error: any) => {
        console.error('Error fetching profile photo:', error);
      }
    });
  }
  
  /**
   * Convert role code to a user-friendly label
   */
  getRoleLabel(role: string): string {
    if (!role) return 'Utilisateur';
    
    const roleMap: {[key: string]: string} = {
      'ROLE_ADMIN': 'Administrateur',
      'ADMIN': 'Administrateur',
      'ROLE_MANAGER': 'Manager',
      'MANAGER': 'Manager',
      'ROLE_USER': 'Utilisateur',
      'USER': 'Utilisateur',
      'EMPLOYEE': 'Employé',
      'ROLE_TEAM_LEADER': 'Chef d\'Équipe',
      'TEAM_LEADER': 'Chef d\'Équipe'
    };
    
    return roleMap[role] || role;
  }
}
