import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { AuthService } from '../login/AuthService';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  carouselData: { heading: string, strong: string }[] = [];
  isLoading: boolean = true;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.loadExcelData(); // Load Excel data on component init
  }

  loadExcelData(): void {
    fetch('./assets/Phrases_Motivation.xlsx') // Path to the Excel file
      .then(response => response.arrayBuffer()) // Convert the response to ArrayBuffer
      .then(data => {
        const workbook = XLSX.read(data, { type: 'array' }); // Read the Excel file
        const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Select the first sheet
        const rows: any[] = XLSX.utils.sheet_to_json(sheet); // Convert sheet to JSON

        // Map the data to format suitable for the carousel
        this.carouselData = rows.slice(0, 3).map(row => ({
          heading: row['Heading']?.trim() || 'Titre non disponible', // Default if missing
          strong: row['Strong']?.trim() || 'Texte non disponible'   // Default if missing
        }));

        // Ensure that at least 3 entries are available
        if (this.carouselData.length < 3) {
          console.error("Le fichier Excel doit contenir au moins 3 entrées");
          this.setDefaultMessages(); // Use default messages if less than 3 entries
        }

        this.isLoading = false; // Disable loading indicator
      })
      .catch(error => {
        console.error("Erreur de chargement du fichier Excel:", error);
        this.setDefaultMessages(); // Fallback to default messages in case of error
        this.isLoading = false;
      });
  }

  private setDefaultMessages(): void {
    // Default messages when the file is missing or incomplete
    this.carouselData = [
      { heading: 'Force intérieure', strong: 'Croyez en votre potentiel' },
      { heading: 'Dépassement de soi', strong: 'Chaque défi est une opportunité' },
      { heading: 'Victoire assurée', strong: 'Votre succès commence ici' }
    ];
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
