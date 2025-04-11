import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TeletravailForm, TeletravailService, TeletravailResponse } from './TeletravailService';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-teletravail',
  templateUrl: './teletravail.component.html',
  styleUrls: ['./teletravail.component.css']
})
export class TeletravailComponent implements OnInit {
  travailType: string = '';
  teletravailDate: string = '';
  travailMaison: string = '';
  selectedPays: string = '';
  selectedGouvernorat: string = '';
  reason: string = '';

  countries: string[] = [];
  filteredGouvernorats: string[] = [];
  startOfCurrentWeek: string = '';
  endOfCurrentWeek: string = '';
  startOfNextWeek: string = '';
  endOfNextWeek: string = '';
  fridayCutoff: string = '';
  today: string = ''; // Added to track today's date for min restriction
  isDateDisabled: boolean = false;
  existingRequestDates: string[] = [];

  constructor(
    private teletravailService: TeletravailService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    console.log('TeletravailComponent: Loading page with token');
    this.calculateWeekDates();
    setInterval(() => this.calculateWeekDates(), 60000);
    this.loadCountries();
    this.loadExistingRequests();
  }

  private loadCountries(): void {
    this.teletravailService.getCountries().subscribe({
      next: (countries) => this.countries = countries,
      error: (err) => {
        console.error('Failed to load countries:', err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger la liste des pays.',
          confirmButtonText: 'OK',
          timer: 3000,
        });
      }
    });
  }

  private loadExistingRequests(): void {
    this.teletravailService.getUserRequests().subscribe({
      next: (requests) => {
        this.existingRequestDates = requests
          .filter(r => {
            const date = new Date(r.teletravailDate);
            const start = new Date(this.startOfCurrentWeek);
            const end = new Date(this.endOfNextWeek);
            return date >= start && date <= end;
          })
          .map(r => r.teletravailDate);
        console.log('Existing request dates:', this.existingRequestDates);
      },
      error: (err) => {
        console.error('Failed to load existing requests:', err);
        let errorMessage = 'Impossible de charger vos demandes existantes. Veuillez réessayer plus tard.';
        if (err.status === 401) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          this.logout();
        } else if (err.status === 0) {
          errorMessage = 'Serveur inaccessible. Vérifiez votre connexion.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: errorMessage,
          confirmButtonText: 'OK',
          timer: 3000,
        });
      }
    });
  }

  calculateWeekDates(): void {
    const today = new Date();
    this.today = this.formatDate(today); // Set today's date
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 6) { // Saturday
      // Start from next Monday (skip current week)
      const startNextMonday = new Date(today);
      startNextMonday.setDate(today.getDate() + (8 - dayOfWeek)); // Move to next Monday
      startNextMonday.setHours(0, 0, 0, 0);
      this.startOfCurrentWeek = this.formatDate(startNextMonday);

      const endNextSunday = new Date(startNextMonday);
      endNextSunday.setDate(startNextMonday.getDate() + 6);
      endNextSunday.setHours(23, 59, 59, 999);
      this.endOfCurrentWeek = this.formatDate(endNextSunday);

      const startFollowingMonday = new Date(startNextMonday);
      startFollowingMonday.setDate(startNextMonday.getDate() + 7);
      startFollowingMonday.setHours(0, 0, 0, 0);
      this.startOfNextWeek = this.formatDate(startFollowingMonday);

      const endFollowingSunday = new Date(startFollowingMonday);
      endFollowingSunday.setDate(startFollowingMonday.getDate() + 6);
      endFollowingSunday.setHours(23, 59, 59, 999);
      this.endOfNextWeek = this.formatDate(endFollowingSunday);

      const friday = new Date(startNextMonday);
      friday.setDate(startNextMonday.getDate() + 4);
      friday.setHours(0, 0, 0, 0);
      this.fridayCutoff = this.formatDate(friday);
    } else { // Any other day (Sunday to Friday)
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startCurrent = new Date(today);
      startCurrent.setDate(today.getDate() - diffToMonday);
      startCurrent.setHours(0, 0, 0, 0);
      this.startOfCurrentWeek = this.formatDate(startCurrent);

      const endCurrent = new Date(startCurrent);
      endCurrent.setDate(startCurrent.getDate() + 6);
      endCurrent.setHours(23, 59, 59, 999);
      this.endOfCurrentWeek = this.formatDate(endCurrent);

      const friday = new Date(startCurrent);
      friday.setDate(startCurrent.getDate() + 4);
      friday.setHours(0, 0, 0, 0);
      this.fridayCutoff = this.formatDate(friday);

      const startNext = new Date(startCurrent);
      startNext.setDate(startCurrent.getDate() + 7);
      startNext.setHours(0, 0, 0, 0);
      this.startOfNextWeek = this.formatDate(startNext);

      const endNext = new Date(startNext);
      endNext.setDate(startNext.getDate() + 6);
      endNext.setHours(23, 59, 59, 999);
      this.endOfNextWeek = this.formatDate(endNext);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  isPastFridayCutoff(): boolean {
    const now = new Date();
    const friday = new Date(this.fridayCutoff);
    friday.setHours(0, 0, 0, 0);
    return now >= friday;
  }

  disableWeekends(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = new Date(input.value);

    const minAllowedDate = new Date(this.today > this.startOfCurrentWeek ? this.today : this.startOfCurrentWeek);
    const maxAllowedDate = new Date(this.endOfNextWeek);

    if (selectedDate < minAllowedDate || selectedDate > maxAllowedDate) {
      this.showDateError('Veuillez sélectionner une date dans les deux semaines affichées, à partir d\'aujourd\'hui.');
      input.value = '';
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les weekends ne sont pas disponibles.');
      input.value = '';
      return;
    }

    if (this.existingRequestDates.includes(input.value)) {
      this.showDateError('Vous avez déjà une demande pour ce jour.');
      input.value = '';
      return;
    }

    const selectedEpoch = selectedDate.getTime() / (1000 * 60 * 60 * 24);
    for (const dateStr of this.existingRequestDates) {
      const existingDate = new Date(dateStr);
      const existingEpoch = existingDate.getTime() / (1000 * 60 * 60 * 24);
      if (Math.abs(selectedEpoch - existingEpoch) === 1) {
        this.showDateError('Les jours de télétravail ne doivent pas être consécutifs.');
        input.value = '';
        return;
      }
    }

    const requestDate = new Date(input.value);
    const weekStart = requestDate >= new Date(this.startOfNextWeek) ? this.startOfNextWeek : this.startOfCurrentWeek;
    const weekEnd = requestDate >= new Date(this.startOfNextWeek) ? this.endOfNextWeek : this.endOfCurrentWeek;
    const requestsInWeek = this.existingRequestDates.filter(d => {
      const date = new Date(d);
      return date >= new Date(weekStart) && date <= new Date(weekEnd);
    });
    if (requestsInWeek.length >= 2) {
      this.showDateError(`Vous avez déjà atteint la limite de 2 jours pour la semaine du ${weekStart}.`);
      input.value = '';
      return;
    }

    this.isDateDisabled = false;
  }

  private showDateError(message: string): void {
    this.isDateDisabled = true;
    Swal.fire({
      icon: 'warning',
      title: 'Date non valide',
      text: message,
      confirmButtonText: 'OK',
      timer: 3000,
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      this.isDateDisabled = false;
    });
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.teletravailDate = input.value;
  }

  onCountryChange(): void {
    this.selectedGouvernorat = '';
    if (this.selectedPays) {
      this.teletravailService.getRegions(this.selectedPays).subscribe({
        next: (regions) => this.filteredGouvernorats = regions,
        error: (err) => {
          console.error('Failed to load regions:', err);
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de charger la liste des régions.',
            confirmButtonText: 'OK',
            timer: 3000,
          });
        }
      });
    } else {
      this.filteredGouvernorats = [];
    }
  }

  onSubmit(): void {
    const requiresLocation = this.travailMaison === 'non';
    const requiresReason = this.travailType !== 'reguliere';

    if (!this.travailType || !this.teletravailDate || !this.travailMaison) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez remplir tous les champs obligatoires.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      return;
    }

    if (requiresLocation && (!this.selectedPays || !this.selectedGouvernorat)) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez sélectionner un pays et une région.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      return;
    }

    if (requiresReason && !this.reason.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez fournir une raison pour une demande non régulière.',
        confirmButtonText: 'OK',
        timer: 3000,
      });
      return;
    }

    const formData: TeletravailForm = {
      travailType: this.travailType,
      teletravailDate: this.teletravailDate,
      travailMaison: this.travailMaison,
      ...(requiresLocation && {
        selectedPays: this.selectedPays,
        selectedGouvernorat: this.selectedGouvernorat
      }),
      ...(requiresReason && { reason: this.reason })
    };

    this.teletravailService.submitRequest(formData).subscribe({
      next: (response) => {
        Swal.fire({
          icon: 'success',
          title: 'Succès',
          text: 'Votre demande de télétravail a été soumise avec succès !',
          confirmButtonText: 'OK',
          timer: 3000,
        }).then(() => {
          this.resetForm();
          this.loadExistingRequests();
        });
      },
      error: (err) => {
        console.error('Failed to submit teletravail request:', err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: err.error?.errorMessage || 'Échec de la soumission. Veuillez réessayer.',
          confirmButtonText: 'OK',
          timer: 5000,
        });
      }
    });
  }

  logout(): void {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      this.router.navigate(['/login']);
      console.log('Logged out successfully');
    } else {
      this.router.navigate(['/login']);
      console.log('No active session found, redirected to login');
    }
  }

  resetForm(): void {
    this.travailType = '';
    this.teletravailDate = '';
    this.travailMaison = '';
    this.selectedPays = '';
    this.selectedGouvernorat = '';
    this.reason = '';
    this.filteredGouvernorats = [];
    this.isDateDisabled = false;
  }
}