import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import SkillsPage from './skills-page';

describe('SkillsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('lists exactly the nine skill names, in order', () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-skill]'),
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'angular-essentials',
      'component-architecture',
      'data-loading',
      'performance-and-zoneless',
      'project-structure',
      'rxjs-interop',
      'signals-essentials',
      'state-management',
      'testing-essentials',
    ]);
  });

  it('renders the selected skill document through the token renderer', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    fixture.componentInstance.select('signals-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('skills/signals-essentials/SKILL.md'))
      .flush({ content: btoa('## Decision table\n\nUse computed().'), encoding: 'base64' });
    await Promise.resolve();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('md-view')).not.toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('Decision table');
  });

  it('strips YAML frontmatter before rendering, so it never appears as content', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    fixture.componentInstance.select('rxjs-interop');
    fixture.detectChanges();
    const frontmatterDoc = [
      '---',
      'name: rxjs-interop',
      'description: MANDATORY for ALL RxJS work.',
      '---',
      '',
      '# RxJS Interop',
      '',
      'Body text.',
    ].join('\n');
    http
      .expectOne((r) => r.url.includes('skills/rxjs-interop/SKILL.md'))
      .flush({ content: btoa(frontmatterDoc), encoding: 'base64' });
    await Promise.resolve();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('name: rxjs-interop');
    expect(text).not.toContain('description:');
    expect(text).toContain('RxJS Interop');
  });

  it('never renders raw HTML from a skill document', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    fixture.componentInstance.select('angular-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('skills/angular-essentials/SKILL.md'))
      .flush({ content: btoa('Text with <img src=x onerror=alert(1)> inside'), encoding: 'base64' });
    await Promise.resolve();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });
});
