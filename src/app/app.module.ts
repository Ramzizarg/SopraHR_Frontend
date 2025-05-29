import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { WorkstationComponent } from './workstation/workstation.component';
import { LoginComponent } from './login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth-interceptor';
import { HomeComponent } from './home/home.component';
import { ForgetpasswordComponent } from './forgetpassword/forgetpassword.component';
import { TeletravailComponent } from './teletravail/teletravail.component';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { PlanningComponent } from './planning/planning.component';
import { AuthService } from './login/AuthService';
import { AuthGuard } from './login/AuthGuard';
import { ReservationComponent } from './reservation/reservation.component';
import { ApiTesterComponent } from './reservation/api-tester.component';
import { SharedModule } from './shared/shared.module';
import { ProfileService } from './services/profile.service';
import { PasswordResetService } from './services/password-reset.service';
import { SoundService } from './services/sound.service';

// Import locale data
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { UsersComponent } from './backoffice/users/users.component';
import { DashboardComponent } from './backoffice/dashboard/dashboard.component';

// Register the locale data
registerLocaleData(localeFr);

@NgModule({
  declarations: [
    AppComponent,
    WorkstationComponent,
    LoginComponent,
    HomeComponent,
    ForgetpasswordComponent,
    TeletravailComponent,
    ResetPasswordComponent,
    PlanningComponent,
    ReservationComponent,
    ApiTesterComponent,
    UsersComponent,
    DashboardComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule,
    BrowserAnimationsModule,
    SharedModule
  ],
  providers: [
    AuthService, 
    AuthGuard,
    PasswordResetService,
    SoundService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
