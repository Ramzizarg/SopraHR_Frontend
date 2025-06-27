import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeletravailBackComponent } from './teletravail-back.component';

describe('TeletravailBackComponent', () => {
  let component: TeletravailBackComponent;
  let fixture: ComponentFixture<TeletravailBackComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TeletravailBackComponent]
    });
    fixture = TestBed.createComponent(TeletravailBackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
