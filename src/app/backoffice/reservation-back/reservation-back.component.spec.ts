import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservationBackComponent } from './reservation-back.component';

describe('ReservationBackComponent', () => {
  let component: ReservationBackComponent;
  let fixture: ComponentFixture<ReservationBackComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReservationBackComponent]
    });
    fixture = TestBed.createComponent(ReservationBackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
