import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ContactStatus = 'idle' | 'sending' | 'success' | 'error';
type PageView = 'home' | 'impressum' | 'datenschutz';

interface ContactFormValue {
  name: string;
  email: string;
  message: string;
}

interface GalleryImage {
  src: string;
  alt: string;
}

interface LegalPageContent {
  title: string;
  intro: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  readonly maxMessageLength = 3000;
  readonly legalPages: Record<Exclude<PageView, 'home'>, LegalPageContent> = {
    impressum: {
      title: 'Impressum',
      intro: 'Diese Seite wird vorbereitet.',
    },
    datenschutz: {
      title: 'Datenschutz',
      intro: 'Diese Seite wird vorbereitet.',
    },
  };
  readonly galleryImages: GalleryImage[] = [
    {
      src: '/images/0C186460-2B56-48A6-86C2-CEEAF2CB683F.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
    {
      src: '/images/IMG_7955.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
    {
      src: '/images/IMG_7952.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
    {
      src: '/images/IMG_7957.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
    {
      src: '/images/IMG_7331.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
    {
      src: '/images/EF2A6470-5F27-481F-9FE4-1384D6CB4EAF.jpeg',
      alt: 'Einblicke in den Betreuungsalltag',
    },
  ];

  contactForm: ContactFormValue = {
    name: '',
    email: '',
    message: '',
  };

  contactStatus: ContactStatus = 'idle';
  contactFeedback = '';
  contactSubmitted = false;
  currentPage = this.resolvePageFromPath(window.location.pathname);
  selectedGalleryImage: GalleryImage | null = null;

  ngOnDestroy(): void {
    this.setPageScrollLocked(false);
  }

  get activeLegalPage(): LegalPageContent | null {
    return this.currentPage === 'home' ? null : this.legalPages[this.currentPage];
  }

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

  openImageModal(image: GalleryImage): void {
    this.selectedGalleryImage = image;
    this.setPageScrollLocked(true);
  }

  closeImageModal(): void {
    this.selectedGalleryImage = null;
    this.setPageScrollLocked(false);
  }

  @HostListener('document:keydown.escape')
  closeImageModalOnEscape(): void {
    if (this.selectedGalleryImage) {
      this.closeImageModal();
    }
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

  private setPageScrollLocked(isLocked: boolean): void {
    document.body.classList.toggle('modal-open', isLocked);
  }

  private resolvePageFromPath(pathname: string): PageView {
    if (pathname === '/impressum') {
      return 'impressum';
    }

    if (pathname === '/datenschutz') {
      return 'datenschutz';
    }

    return 'home';
  }
}
