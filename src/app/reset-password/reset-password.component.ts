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

  onSubmit(): void {
    this.submitted = true;
    this.successMessage = null;
    this.errorMessage = null;

    if (this.resetPasswordForm.invalid || !this.token) {
      return;
    }

    const newPassword = this.resetPasswordForm.value.newPassword;
    const payload = { token: this.token, newPassword };

    this.http.post(`${environment.apiUrl}/auth/reset-password`, payload)
      .subscribe({
        next: (response: any) => {
          this.successMessage = response.message || 'Password reset successfully! Redirecting to login in 5 seconds...';
          // Redirect to login page after 5 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 5000); // 5000ms = 5 seconds
        },
        error: (error) => {
          this.errorMessage = error.error?.errorMessage || 'Failed to reset password. The link may be invalid or expired.';
        }
      });
  }
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:9001' // Adjust to your backend URL
};