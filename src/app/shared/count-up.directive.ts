import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[countUp]'
})
export class CountUpDirective implements OnChanges {
  @Input('countUp') endValue: number = 0;
  @Input() duration: number = 900;
  private startValue = 0;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['endValue']) {
      this.animateCount();
    }
  }

  animateCount() {
    const el = this.el.nativeElement;
    const start = this.startValue;
    const end = this.endValue;
    const duration = this.duration;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      el.textContent = value;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = end;
      }
    };
    requestAnimationFrame(step);
  }
} 