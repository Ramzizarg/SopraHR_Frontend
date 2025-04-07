import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { WorkstationComponent } from './workstation/workstation.component';
import { LoginComponent } from './login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { HomeComponent } from './home/home.component';
import { ForgetpasswordComponent } from './forgetpassword/forgetpassword.component';
import { TeletravailComponent } from './teletravail/teletravail.component';
import { ReservationComponent } from './reservation/reservation.component';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { PlanningComponent } from './planning/planning.component';
import { AuthService } from './login/AuthService';
import { AuthGuard } from './login/AuthGuard';


@NgModule({
  declarations: [
    AppComponent,
    WorkstationComponent,
    LoginComponent,
    HomeComponent,
    ForgetpasswordComponent,
    TeletravailComponent,
    ReservationComponent,
    ResetPasswordComponent,
    PlanningComponent,
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
    
    ],
    providers: [AuthService, AuthGuard],
      bootstrap: [AppComponent]
})
export class AppModule { }
