import { Component } from '@angular/core';
import { AuthService } from '../login/AuthService';


@Component({
  selector: 'app-reservation-desk',
  templateUrl: './reservation-desk.component.html',
  styleUrls: ['./reservation-desk.component.css']
})


export class ReservationDeskComponent {
  router: any;


    constructor(
      private authService: AuthService
    ) {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
