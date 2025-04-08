// teletravail.component.ts
import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { TeletravailForm, TeletravailService } from './TeletravailService';

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
  isDateDisabled: boolean = false;

  constructor(
    private teletravailService: TeletravailService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!localStorage.getItem('token')) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.calculateWeekDates();
    setInterval(() => this.calculateWeekDates(), 60000);
    this.loadCountries();
  }

  private loadCountries(): void {
    this.teletravailService.getCountries().subscribe({
      next: (countries) => {
        this.countries = countries;
      },
      error: () => {
        Swal.fire('Erreur', 'Impossible de charger les pays', 'error');
      }
    });
  }

  calculateWeekDates(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
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

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private isPastFridayCutoff(): boolean {
    const now = new Date();
    const friday = new Date(this.fridayCutoff);
    friday.setHours(0, 0, 0, 0);
    return now >= friday;
  }

  disableWeekends(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = new Date(input.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPastCutoff = this.isPastFridayCutoff();
    const minAllowedDate = isPastCutoff ? 
      new Date(this.startOfNextWeek) : 
      new Date(this.startOfCurrentWeek);

    if (selectedDate < minAllowedDate) {
      this.showDateError(
        isPastCutoff ? 
        'Veuillez sélectionner une date de la semaine prochaine' : 
        'Veuillez sélectionner une date de cette semaine ou la semaine prochaine'
      );
      input.value = '';
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les weekends ne sont pas disponibles');
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
        next: (regions) => {
          this.filteredGouvernorats = regions;
        },
        error: () => {
          Swal.fire('Erreur', 'Impossible de charger les régions', 'error');
          this.filteredGouvernorats = [];
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
      this.showError('Veuillez remplir tous les champs obligatoires de base');
      return;
    }

    if (requiresLocation && (!this.selectedPays || !this.selectedGouvernorat)) {
      this.showError('Veuillez sélectionner un pays et un gouvernorat');
      return;
    }

    if (requiresReason && !this.reason.trim()) {
      this.showError('Veuillez fournir une raison');
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
          confirmButtonText: 'OK'
        });
        this.resetForm();
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: error.message || 'Échec de la soumission de la demande',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  private showError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Champs manquants',
      text: message,
      confirmButtonText: 'OK'
    });
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