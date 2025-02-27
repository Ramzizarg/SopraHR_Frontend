import { Component } from '@angular/core';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent {
  onSubmit() {
      console.log('Form submitted');
      // Add your password reset logic here
      // Typically, you'd call a service to send the new password to your backend
  }
}