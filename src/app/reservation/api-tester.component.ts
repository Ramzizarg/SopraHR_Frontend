import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../login/AuthService';

@Component({
  selector: 'app-api-tester',
  template: `
    <div style="padding: 20px; background: #f5f5f5; border-radius: 5px; margin: 20px; max-width: 800px;">
      <h2>API Authentication Tester</h2>
      
      <div style="margin-bottom: 20px;">
        <h3>Authentication Status</h3>
        <p>Token exists: <strong>{{ hasToken ? 'Yes' : 'No' }}</strong></p>
        <p>User logged in: <strong>{{ isLoggedIn ? 'Yes' : 'No' }}</strong></p>
        <p>User is manager: <strong>{{ isManager ? 'Yes' : 'No' }}</strong></p>
        <button (click)="checkUserProfile()" class="btn">Check User Profile</button>
        <div *ngIf="userProfile">
          <pre>{{ userProfile | json }}</pre>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3>API Test</h3>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
          <select [(ngModel)]="apiEndpoint" style="flex-grow: 1; padding: 8px;">
            <option value="http://localhost:6001/api/v1/plans">GET - Plans</option>
            <option value="http://localhost:6001/api/v1/desks/plan/1">GET - Desks (Plan 1)</option>
            <option value="http://localhost:6001/api/v1/walls/plan/1">GET - Walls (Plan 1)</option>
            <option value="http://localhost:6001/api/v1/reservations/user">GET - User Reservations</option>
          </select>
          <button (click)="testAPI()" class="btn">Test API</button>
        </div>
        
        <div style="margin-top: 10px;">
          <h4>Raw Token</h4>
          <textarea [(ngModel)]="manualToken" rows="3" style="width: 100%; font-family: monospace; padding: 8px;"></textarea>
          <button (click)="testWithManualToken()" class="btn" style="margin-top: 5px;">Test with Manual Token</button>
        </div>
        
        <div *ngIf="apiResult" style="margin-top: 20px;">
          <h4>API Response</h4>
          <div style="background: #fff; padding: 10px; border-radius: 4px; max-height: 300px; overflow: auto;">
            <pre>{{ apiResult | json }}</pre>
          </div>
        </div>
        
        <div *ngIf="apiError" style="margin-top: 20px;">
          <h4>API Error</h4>
          <div style="background: #fff0f0; padding: 10px; border-radius: 4px; max-height: 300px; overflow: auto;">
            <p><strong>Status:</strong> {{ apiError.status }}</p>
            <p><strong>Message:</strong> {{ apiError.message }}</p>
            <pre>{{ apiError.details | json }}</pre>
          </div>
        </div>
      </div>
      
      <div>
        <h3>Manual Login</h3>
        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 400px;">
          <input [(ngModel)]="loginEmail" placeholder="Email" style="padding: 8px;">
          <input [(ngModel)]="loginPassword" type="password" placeholder="Password" style="padding: 8px;">
          <button (click)="login()" class="btn">Login</button>
        </div>
        <div *ngIf="loginResult" style="margin-top: 10px;">
          <pre>{{ loginResult | json }}</pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .btn {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn:hover {
      background: #0056b3;
    }
  `]
})
export class ApiTesterComponent implements OnInit {
  hasToken = false;
  isLoggedIn = false;
  isManager = false;
  userProfile: any = null;
  
  apiEndpoint = 'http://localhost:6001/api/v1/plans';
  apiResult: any = null;
  apiError: any = null;
  
  manualToken = '';
  
  loginEmail = '';
  loginPassword = '';
  loginResult: any = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.hasToken = !!this.authService.getToken();
    this.isLoggedIn = this.authService.isLoggedIn();
    this.isManager = this.authService.isManager();
    this.manualToken = this.authService.getToken() || '';
  }

  checkUserProfile() {
    this.authService.loadUserProfile().subscribe(
      profile => {
        this.userProfile = profile;
        console.log('User profile loaded:', profile);
      },
      error => {
        this.userProfile = { error: error.message || 'Error loading profile' };
        console.error('Error loading profile:', error);
      }
    );
  }

  testAPI() {
    this.apiResult = null;
    this.apiError = null;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
    
    console.log('Testing API with endpoint:', this.apiEndpoint);
    console.log('Headers:', headers);
    
    this.http.get(this.apiEndpoint, { headers }).subscribe(
      result => {
        this.apiResult = result;
        console.log('API test result:', result);
      },
      error => {
        this.apiError = {
          status: error.status,
          message: error.message,
          details: error.error
        };
        console.error('API test error:', error);
      }
    );
  }

  testWithManualToken() {
    this.apiResult = null;
    this.apiError = null;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.manualToken.trim()}`
    });
    
    console.log('Testing API with manual token');
    
    this.http.get(this.apiEndpoint, { headers }).subscribe(
      result => {
        this.apiResult = result;
        console.log('API test result with manual token:', result);
      },
      error => {
        this.apiError = {
          status: error.status,
          message: error.message,
          details: error.error
        };
        console.error('API test error with manual token:', error);
      }
    );
  }

  login() {
    this.loginResult = null;
    
    this.http.post('http://localhost:9001/auth/login', {
      email: this.loginEmail,
      password: this.loginPassword
    }).subscribe(
      result => {
        this.loginResult = result;
        console.log('Login result:', result);
        
        // Store token if present
        if (result && (result as any).token) {
          localStorage.setItem('auth_token', (result as any).token);
          localStorage.setItem('accessToken', (result as any).token);
          this.manualToken = (result as any).token;
          this.hasToken = true;
          this.isLoggedIn = true;
          
          // Refresh manager status
          setTimeout(() => {
            this.checkUserProfile();
            this.isManager = this.authService.isManager();
          }, 500);
        }
      },
      error => {
        this.loginResult = {
          error: error.message,
          details: error.error
        };
        console.error('Login error:', error);
      }
    );
  }
}
