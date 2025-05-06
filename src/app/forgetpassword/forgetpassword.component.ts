import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {}

  // Getter for form controls
  get f() { return this.forgotPasswordForm.controls; }

  onSubmit(): void {
    this.submitted = true;
    this.successMessage = null;
    this.errorMessage = null;

    if (this.forgotPasswordForm.invalid) {
      return;
    }

    const email = this.forgotPasswordForm.value.email;
    this.http.post(`${environment.apiUrl}/auth/forgot-password`, { email })
      .subscribe({
        next: (response: any) => {
          this.successMessage = response.message || 'If the email exists, a reset link has been sent.';
        },
        error: (error) => {
          this.errorMessage = error.error?.errorMessage || 'An error occurred. Please try again.';
        }
      });
  }
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:9001' // Adjust to your backend URL
};