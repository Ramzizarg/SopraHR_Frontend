import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router'; // Added Router

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  submitted = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  token: string | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router // Added Router
  ) {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Extract token from URL query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.errorMessage = 'Invalid or missing reset token. Please check your link.';
      }
    });
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  // Getter for form controls
  get f() { return this.resetPasswordForm.controls; }

  // Clear success message
  clearSuccess() {
    this.successMessage = null;
  }

  // Clear error message
  clearError() {
    this.errorMessage = null;
  }

  onSubmit(): void {
    this.submitted = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.loading = true;

    if (this.resetPasswordForm.invalid || !this.token) {
      this.loading = false;
      return;
    }

    const newPassword = this.resetPasswordForm.value.newPassword;
    const payload = { token: this.token, newPassword };

    this.http.post(`${environment.apiUrl}/auth/reset-password`, payload)
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          this.successMessage = response.message || 'Password reset successfully! Redirecting to login in 5 seconds...';
          this.resetPasswordForm.reset();
          this.submitted = false;
          // Redirect to login page after 5 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 5000); // 5000ms = 5 seconds
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.error?.errorMessage || 'Failed to reset password. The link may be invalid or expired.';
        }
      });
  }
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:9001' // Adjust to your backend URL
};