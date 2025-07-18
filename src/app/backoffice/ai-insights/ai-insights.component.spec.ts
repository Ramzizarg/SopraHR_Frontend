import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AIInsightsComponent } from './ai-insights.component';
import { AIDecisionService } from '../../services/ai-decision.service';

describe('AIInsightsComponent', () => {
  let component: AIInsightsComponent;
  let fixture: ComponentFixture<AIInsightsComponent>;
  let aiService: AIDecisionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AIInsightsComponent ],
      imports: [ HttpClientTestingModule ],
      providers: [ AIDecisionService ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AIInsightsComponent);
    component = fixture.componentInstance;
    aiService = TestBed.inject(AIDecisionService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with loading state', () => {
    expect(component.loading).toBe(true);
    expect(component.error).toBe(false);
  });

  it('should handle error state', () => {
    component.error = true;
    fixture.detectChanges();
    expect(component.error).toBe(true);
  });
}); 