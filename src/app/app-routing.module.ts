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
import { UsersComponent } from './backoffice/users/users.component';
import { DashboardComponent } from './backoffice/dashboard/dashboard.component';

const routes: Routes = [
  // Public routes - accessible without login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgetpasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Protected routes - require authentication
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard]},
  { path: 'reservation', component: ReservationComponent, canActivate: [AuthGuard]},
  { path: 'api-test', component: ApiTesterComponent, canActivate: [AuthGuard]},
  { path: 'planning', component: PlanningComponent, canActivate: [AuthGuard]},
  { path: 'teletravail', component: TeletravailComponent, canActivate: [AuthGuard]},
  { path: 'users', component: UsersComponent, canActivate: [AuthGuard], data: { requiresAdmin: true } },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard], data: { requiresAdmin: true } },


  { path: '**', redirectTo: 'login' },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
