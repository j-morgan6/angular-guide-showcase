import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows a rate-limit explanation when rate limited', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', true);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('rate limit');
    expect(text).toContain('60 requests');
  });

  it('shows the actual failure message when not rate limited', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', false);
    fixture.componentRef.setInput('message', 'Network unreachable');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Network unreachable',
    );
  });

  it('emits retry when the retry button is pressed', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', false);
    fixture.componentRef.setInput('message', 'boom');
    let emitted = false;
    fixture.componentInstance.retry.subscribe(() => (emitted = true));
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    button?.click();
    expect(emitted).toBe(true);
  });
});
