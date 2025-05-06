import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ForgetpasswordComponent } from './forgetpassword/forgetpassword.component';
import { TeletravailComponent } from './teletravail/teletravail.component';
import { ReservationComponent } from './reservation/reservation.component';
import { ApiTesterComponent } from './reservation/api-tester.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { PlanningComponent } from './planning/planning.component';
import { AuthGuard } from './login/AuthGuard';
import { ReservationDeskComponent } from './reservation-desk/reservation-desk.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard]},
  { path: 'forgot-password', component: ForgetpasswordComponent },
  { path: 'reservation', component: ReservationComponent, canActivate: [AuthGuard]},
  { path: 'api-test', component: ApiTesterComponent},
  {path: 'reset-password', component: ResetPasswordComponent}, 
  { path: 'planning', component: PlanningComponent, canActivate: [AuthGuard]},
  { path: 'teletravail', component: TeletravailComponent, canActivate: [AuthGuard]},
  { path: 'reservationdesk', component: ReservationDeskComponent, canActivate: [AuthGuard]},


  { path: '**', redirectTo: 'login' },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
