import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows the actual failure message when not stale', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('message', 'Network unreachable');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Network unreachable',
    );
  });

  it('shows the stale-data explanation, preferring the sync error text when present', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('message', '');
    fixture.componentRef.setInput('stale', true);
    fixture.componentRef.setInput('syncError', 'connection refused');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('out of date');
    expect(text).toContain('connection refused');
  });

  it('emits retry when the retry button is pressed', () => {
    const fixture = TestBed.createComponent(ErrorState);
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
    fixture.componentRef.setInput('message', 'boom');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]'),
    ).not.toBeNull();
  });
});
