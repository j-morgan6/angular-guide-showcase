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

  it('carries role="alert" so assistive tech announces it without polling', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', false);
    fixture.componentRef.setInput('message', 'boom');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]'),
    ).not.toBeNull();
  });

  it('shows a concrete local reset time when resetAt is given', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', true);
    fixture.componentRef.setInput('message', '');
    // 2026-09-10T14:30:00Z as epoch seconds — asserted via the same
    // Date/local-time conversion the component uses, so this test does not
    // hardcode a timezone-dependent clock string.
    const epochSeconds = Math.floor(Date.parse('2026-09-10T14:30:00Z') / 1000);
    fixture.componentRef.setInput('resetAt', epochSeconds);
    fixture.detectChanges();
    const expected = new Date(epochSeconds * 1000);
    const hh = String(expected.getHours()).padStart(2, '0');
    const mm = String(expected.getMinutes()).padStart(2, '0');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(`resets at ${hh}:${mm}`);
    expect(text).not.toContain('Invalid Date');
  });

  it('falls back to "within the hour" when resetAt is absent', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', true);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('resets within the hour');
    expect(text).not.toContain('Invalid Date');
  });

  it('falls back to "within the hour" rather than rendering Invalid Date when resetAt cannot parse to a valid time', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', true);
    fixture.componentRef.setInput('message', '');
    fixture.componentRef.setInput('resetAt', Number.NaN);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('resets within the hour');
    expect(text).not.toContain('Invalid Date');
  });
});
