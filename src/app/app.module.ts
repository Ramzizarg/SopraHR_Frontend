import { NgModule, LOCALE_ID } from '@angular/core';
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
import { CommonModule, DatePipe } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { AuthService } from './login/AuthService';
import { AuthGuard } from './login/AuthGuard';
import { ReservationComponent } from './reservation/reservation.component';
import { ApiTesterComponent } from './reservation/api-tester.component';
import { SharedModule } from './shared/shared.module';
import { ProfileService } from './services/profile.service';
import { PlanningComponent } from './planning/planning.component';
import { PasswordResetService } from './services/password-reset.service';
import { SoundService } from './services/sound.service';
import { BFCacheService } from './services/bfcache.service';
import { GererDemandeComponent } from './gerer-demande/gerer-demande.component';
import { ReclamationBackComponent } from './backoffice/reclamation-back/reclamation-back.component';
import { NgApexchartsModule } from 'ng-apexcharts';

// Import locale data
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { UsersComponent } from './backoffice/users/users.component';
import { DashboardComponent } from './backoffice/dashboard/dashboard.component';
import { TeletravailBackComponent } from './backoffice/teletravail-back/teletravail-back.component';
import { PlanningBackComponent } from './backoffice/planning-back/planning-back.component';
import { ReservationBackComponent } from './backoffice/reservation-back/reservation-back.component';


// Register the locale data
registerLocaleData(localeFr, 'fr');

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
    TeletravailBackComponent,
    PlanningBackComponent,
    ReservationBackComponent,
    GererDemandeComponent,
    ReclamationBackComponent
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
    SharedModule,
    NgApexchartsModule
  ],
  providers: [
    AuthService, 
    AuthGuard,
    PasswordResetService,
    SoundService,
    BFCacheService,
    DatePipe,
    ProfileService,
    { provide: LOCALE_ID, useValue: 'fr' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
