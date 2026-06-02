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
