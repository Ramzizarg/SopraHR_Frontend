import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningBackComponent } from './planning-back.component';

describe('PlanningBackComponent', () => {
  let component: PlanningBackComponent;
  let fixture: ComponentFixture<PlanningBackComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningBackComponent]
    });
    fixture = TestBed.createComponent(PlanningBackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
