import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';

interface TeletravailForm {
  travailType: string;
  teletravailDate: string;
  travailMaison: string;
  selectedPays?: string;
  selectedGouvernorat?: string;
  reason?: string;
}

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

  gouvernorats: { [key: string]: string[] } = {
    tunisie: [
      'Ariana', 'Beja', 'Ben Arous', 'Bizerte', 'Gabes', 'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kebili', 'Kef',
      'Mahdia', 'Manouba', 'Medenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Tataouine', 'Tozeur',
      'Tunis', 'Zaghouan'
    ],
    maroc: [
      'Agadir-Ida-Outanane', 'Azilal', 'Benslimane', 'Benimellal', 'Casablanca-Settat', 'Chefchaouen', 'El Jadida',
      'Fes-Meknes', 'Guelmim-Oued Noun', 'Ifrane', 'Khenifra', 'Khenitra', 'Khouribga', 'L’Oriental', 'Marrakech-Safi',
      'Meknes', 'Mohammadia', 'Rabat-Sale-Kenitra', 'Safi', 'Settat', 'Sidi Kacem', 'Tanger-Tetouan-Al Hoceima',
      'Taroudant', 'Taza', 'Tiznit', 'Zagora'
    ]
  };

  filteredGouvernorats: string[] = [];
  startOfCurrentWeek: string = '';
  endOfCurrentWeek: string = '';
  startOfNextWeek: string = '';
  endOfNextWeek: string = '';
  fridayCutoff: string = '';
  isDateDisabled: boolean = false;

  constructor() {}

  ngOnInit(): void {
    this.calculateWeekDates();
    // Optional: Add interval to recalculate dates periodically
    setInterval(() => this.calculateWeekDates(), 60000); // Recalculate every minute
  }

  /**
   * Calculate week dates and Friday cutoff
   */
  calculateWeekDates(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Current week (Monday to Sunday)
    const startCurrent = new Date(today);
    startCurrent.setDate(today.getDate() - diffToMonday);
    startCurrent.setHours(0, 0, 0, 0);
    this.startOfCurrentWeek = this.formatDate(startCurrent);

    const endCurrent = new Date(startCurrent);
    endCurrent.setDate(startCurrent.getDate() + 6); // End of current week
    endCurrent.setHours(23, 59, 59, 999);
    this.endOfCurrentWeek = this.formatDate(endCurrent);

    // Friday cutoff at 00:00
    const friday = new Date(startCurrent);
    friday.setDate(startCurrent.getDate() + 4); // Friday is 4 days after Monday
    friday.setHours(0, 0, 0, 0);
    this.fridayCutoff = this.formatDate(friday);

    // Next week (Monday to Sunday)
    const startNext = new Date(startCurrent);
    startNext.setDate(startCurrent.getDate() + 7);
    startNext.setHours(0, 0, 0, 0);
    this.startOfNextWeek = this.formatDate(startNext);

    const endNext = new Date(startNext);
    endNext.setDate(startNext.getDate() + 13);
    endNext.setHours(23, 59, 59, 999);
    this.endOfNextWeek = this.formatDate(endNext);

    // Week after next (Monday to Sunday)
    const startWeekAfterNext = new Date(startNext);
    startWeekAfterNext.setDate(startNext.getDate() + 7);
    startWeekAfterNext.setHours(0, 0, 0, 0);
    const startOfWeekAfterNext = this.formatDate(startWeekAfterNext);

    const endWeekAfterNext = new Date(startWeekAfterNext);
    endWeekAfterNext.setDate(startWeekAfterNext.getDate() + 6);
    endWeekAfterNext.setHours(23, 59, 59, 999);
    const endOfWeekAfterNext = this.formatDate(endWeekAfterNext);

    // Next Friday cutoff at 00:00
    const nextFriday = new Date(startNext);
    nextFriday.setDate(startNext.getDate() + 4); // Friday is 4 days after next Monday
    nextFriday.setHours(0, 0, 0, 0);
    const nextFridayCutoff = this.formatDate(nextFriday);

    console.log(`Current Week: ${this.startOfCurrentWeek} to ${this.endOfCurrentWeek}`);
    console.log(`Next Week: ${this.startOfNextWeek} to ${this.endOfNextWeek}`);
    console.log(`Week After Next: ${startOfWeekAfterNext} to ${endOfWeekAfterNext}`);
    console.log(`Next Friday Cutoff: ${nextFridayCutoff}`);
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Check if we're past Friday cutoff
   */
  private isPastFridayCutoff(): boolean {
    const now = new Date();
    const friday = new Date(this.fridayCutoff);
    friday.setHours(0, 0, 0, 0);
    return now >= friday;
  }

  /**
   * Validate selected date based on Friday cutoff
   */
  disableWeekends(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = new Date(input.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPastCutoff = this.isPastFridayCutoff();
    const minAllowedDate = isPastCutoff ? 
      new Date(this.startOfNextWeek) : 
      new Date(this.startOfCurrentWeek);

    // Check if date is before minimum allowed date
    if (selectedDate < minAllowedDate) {
      this.showDateError(
        isPastCutoff ? 
        'Veuillez sélectionner une date de la semaine prochaine' : 
        'Veuillez sélectionner une date de cette semaine ou la semaine prochaine'
      );
      input.value = '';
      return;
    }

    // Check if weekend
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.showDateError('Les weekends ne sont pas disponibles');
      input.value = '';
      return;
    }

    this.isDateDisabled = false;
  }

  /**
   * Show date validation error
   */
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
    this.filteredGouvernorats = this.selectedPays ? 
      this.gouvernorats[this.selectedPays.toLowerCase()] || [] : [];
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

    Swal.fire({
      icon: 'success',
      title: 'Succès',
      text: 'Votre demande de télétravail a été soumise avec succès !',
      confirmButtonText: 'OK'
    });

    this.resetForm();
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