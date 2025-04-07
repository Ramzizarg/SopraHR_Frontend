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
        console.log('LoginComponent: Login successful, redirecting after 2 seconds');
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 500);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.errorMessage || 'Login failed. Please try again.';
      }
      
    });
  }

  navigateToForgetPassword() {
    this.router.navigate(['/forgot-password']);
  }

  
}