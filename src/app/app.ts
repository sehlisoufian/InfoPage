import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ContactStatus = 'idle' | 'sending' | 'success' | 'error';

interface ContactFormValue {
  name: string;
  email: string;
  message: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  readonly maxMessageLength = 3000;

  contactForm: ContactFormValue = {
    name: '',
    email: '',
    message: '',
  };

  contactStatus: ContactStatus = 'idle';
  contactFeedback = '';
  contactSubmitted = false;

  get remainingMessageCharacters(): number {
    return this.maxMessageLength - this.contactForm.message.length;
  }

  get isSendingContactForm(): boolean {
    return this.contactStatus === 'sending';
  }

  isEmailInvalid(): boolean {
    if (!this.contactSubmitted) {
      return false;
    }

    const email = this.contactForm.email.trim();
    return !email || !this.emailPattern.test(email);
  }

  isMessageInvalid(): boolean {
    if (!this.contactSubmitted) {
      return false;
    }

    const message = this.contactForm.message.trim();
    return !message || message.length > this.maxMessageLength;
  }

  submitContactForm(): void {
    this.contactSubmitted = true;
    this.contactFeedback = '';
    this.contactStatus = 'idle';

    const payload = {
      name: this.contactForm.name.trim(),
      email: this.contactForm.email.trim(),
      message: this.contactForm.message.trim(),
    };

    if (!this.isValidContactPayload(payload)) {
      this.contactStatus = 'error';
      this.contactFeedback = 'Bitte prüfen Sie die markierten Felder.';
      return;
    }

    this.contactStatus = 'sending';

    this.http.post('/api/contact', payload).subscribe({
      next: () => {
        this.contactStatus = 'success';
        this.contactFeedback =
          'Vielen Dank für Ihre Nachricht. Ich melde mich so bald wie möglich zurück.';
        this.contactSubmitted = false;
        this.contactForm = {
          name: '',
          email: '',
          message: '',
        };
      },
      error: () => {
        this.contactStatus = 'error';
        this.contactFeedback =
          'Die Nachricht konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.';
      },
    });
  }

  private isValidContactPayload(payload: ContactFormValue): boolean {
    return (
      this.emailPattern.test(payload.email) &&
      payload.message.length > 0 &&
      payload.message.length <= this.maxMessageLength
    );
  }
}
