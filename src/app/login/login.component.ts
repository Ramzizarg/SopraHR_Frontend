// login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from './AuthService';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  loading = false;
  showPassword = false;
  hasPasswordInput = false; // Track if password field has content

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false] // Default to unchecked
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const email = this.loginForm.get('email')?.value;
    const password = this.loginForm.get('password')?.value;
    const rememberMe = this.loginForm.get('rememberMe')?.value;

    this.authService.login(email, password, rememberMe).subscribe({
      next: () => {
        this.loading = true;
        // Check if user is admin and redirect accordingly
        setTimeout(() => {
          if (this.authService.isAdmin()) {
            console.log('LoginComponent: Admin user detected, navigating to dashboard');
            this.router.navigate(['/dashboard']);
          } else {
            console.log('LoginComponent: Regular user, navigating to home');
            this.router.navigate(['/home']);
          }
        }, 500);
      },
      error: (error) => {
        this.loading = false;
        // Use the error message directly from our improved AuthService handler
        if (error instanceof Error) {
          this.errorMessage = error.message;
        } else if (typeof error === 'string') {
          this.errorMessage = error;
        } else {
          this.errorMessage = 'Une erreur s\'est produite. Veuillez réessayer.';
        }
        console.error('Login error:', error);
      }
    });
  }

  navigateToForgetPassword() {
    this.router.navigate(['/forgot-password']);
  }
  
  // Method to clear error message
  clearError() {
    this.errorMessage = null;
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
  
  // Check if password field has content
  checkPasswordInput() {
    const passwordValue = this.loginForm.get('password')?.value;
    this.hasPasswordInput = passwordValue && passwordValue.length > 0;
  }
  
}