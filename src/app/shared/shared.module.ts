import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileHeaderComponent } from './components/profile/profile-header.component';
import { CountUpDirective } from './count-up.directive';

@NgModule({
  declarations: [
    ProfileHeaderComponent,
    CountUpDirective
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ProfileHeaderComponent,
    CountUpDirective
  ]
})
export class SharedModule { }
