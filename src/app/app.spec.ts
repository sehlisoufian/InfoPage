import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the daycare headline', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Geborgen wachsen');
  });

  it('should render placeholder legal pages', () => {
    const previousPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.history.pushState({}, '', '/impressum');
      const impressumFixture = TestBed.createComponent(App);
      impressumFixture.detectChanges();
      const impressum = impressumFixture.nativeElement as HTMLElement;
      expect(impressum.querySelector('#legal-page-title')?.textContent).toContain('Impressum');

      window.history.pushState({}, '', '/datenschutz');
      const privacyFixture = TestBed.createComponent(App);
      privacyFixture.detectChanges();
      const privacy = privacyFixture.nativeElement as HTMLElement;
      expect(privacy.querySelector('#legal-page-title')?.textContent).toContain('Datenschutz');
    } finally {
      window.history.pushState({}, '', previousPath);
    }
  });

  it('should render the Instagram placeholder link in the footer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const instagramLink = compiled.querySelector<HTMLAnchorElement>(
      'footer a[href="https://www.instagram.com/instagram_name_hier_eintragen/"]',
    );

    expect(instagramLink?.textContent).toContain('@instagram_name_hier_eintragen');
    expect(instagramLink?.target).toBe('_blank');
  });

  it('should show the contact form', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#contact-email')).toBeTruthy();
    expect(compiled.querySelector('#contact-message')).toBeTruthy();
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain('Nachricht senden');
  });

  it('should validate the contact form before sending', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    component.contactForm = {
      name: '',
      email: 'ungueltig',
      message: '',
    };

    component.submitContactForm();

    httpMock.expectNone('/api/contact');
    expect(component.contactStatus).toBe('error');
    expect(component.contactFeedback).toContain('markierten Felder');
  });

  it('should send valid contact requests to the API endpoint', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    component.contactForm = {
      name: 'Mia Muster',
      email: 'mia@example.de',
      message: 'Hallo, ich interessiere mich für einen Betreuungsplatz.',
    };

    component.submitContactForm();

    const request = httpMock.expectOne('/api/contact');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Mia Muster',
      email: 'mia@example.de',
      message: 'Hallo, ich interessiere mich für einen Betreuungsplatz.',
    });

    request.flush({ message: 'ok' });

    expect(component.contactStatus).toBe('success');
    expect(component.contactFeedback).toContain('Vielen Dank');
    expect(component.contactForm.email).toBe('');
    expect(component.contactForm.message).toBe('');
  });
});
