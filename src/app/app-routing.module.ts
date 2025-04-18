import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ForgetpasswordComponent } from './forgetpassword/forgetpassword.component';
import { TeletravailComponent } from './teletravail/teletravail.component';
import { ReservationComponent } from './reservation/reservation.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { PlanningComponent } from './planning/planning.component';
import { AuthGuard } from './login/AuthGuard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard]},
  { path: 'forgot-password', component: ForgetpasswordComponent },
  { path: 'reservation', component: ReservationComponent},
  {path: 'reset-password', component: ResetPasswordComponent}, 
  { path: 'planning', component: PlanningComponent},
  { path: 'teletravail', component: TeletravailComponent},






  { path: '**', redirectTo: 'login' },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
