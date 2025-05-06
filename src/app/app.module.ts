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
import { ReservationDeskComponent } from './reservation-desk/reservation-desk.component';

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
    ReservationDeskComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule,
    BrowserAnimationsModule
  ],
  providers: [
    AuthService, 
    AuthGuard,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
