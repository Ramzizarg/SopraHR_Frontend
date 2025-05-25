import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileHeaderComponent } from './components/profile/profile-header.component';

@NgModule({
  declarations: [
    ProfileHeaderComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ProfileHeaderComponent
  ]
})
export class SharedModule { }
