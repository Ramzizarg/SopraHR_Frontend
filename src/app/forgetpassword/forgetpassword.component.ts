import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgetpassword',
  templateUrl: './forgetpassword.component.html',
  styleUrls: ['./forgetpassword.component.css']
})
export class ForgetpasswordComponent implements OnInit {
  forgotPasswordForm: FormGroup;
  submitted = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  loading = false;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {}

  // Getter for form controls
  get f() { return this.forgotPasswordForm.controls; }

  clearError(): void {
    this.errorMessage = null;
  }

  clearSuccess(): void {
    this.successMessage = null;
  }

  onSubmit(): void {
    this.submitted = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.loading = true;

    if (this.forgotPasswordForm.invalid) {
      this.loading = false;
      return;
    }

    const email = this.forgotPasswordForm.value.email;
    this.http.post(`${environment.apiUrl}/auth/forgot-password`, { email })
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          this.successMessage = response.message || 'If the email exists, a reset link has been sent.';
          this.forgotPasswordForm.reset();
          this.submitted = false;
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.error?.errorMessage || 'An error occurred. Please try again.';
        }
      });
  }
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:9001' // Adjust to your backend URL
};