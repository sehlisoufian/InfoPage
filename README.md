# InfoPage

Freundliche Angular-Infoseite für eine Tagesmutter mit Galerie, Kontaktbereich und
Vercel-kompatibler Serverless Function für das Kontaktformular.

## Lokal starten

```bash
npm install
npm start
```

Die Seite läuft danach unter `http://localhost:4200/`.

## Kontaktformular lokal testen

Das Angular-Formular sendet eine `POST`-Anfrage an `/api/contact`. Dieser Endpunkt liegt als
Vercel Serverless Function in `api/contact.js`.

Für einen lokalen Ende-zu-Ende-Test mit API-Route:

```bash
cp .env.example .env.local
npx vercel dev
```

Für Tests ohne echten Mailversand kann in `.env.local` gesetzt werden:

```bash
CONTACT_DRY_RUN=true
```

Dann validiert die Function die Anfrage und antwortet erfolgreich, ohne SMTP zu verwenden.

## Environment Variables

Es dürfen keine echten Zugangsdaten im Repository gespeichert werden. Die Werte werden später in
Vercel, Netlify oder lokal in `.env.local` gesetzt.

| Variable | Bedeutung |
| --- | --- |
| `SMTP_HOST` | SMTP-Server des Mailanbieters |
| `SMTP_PORT` | SMTP-Port, z. B. `587` oder `465` |
| `SMTP_USER` | SMTP-Benutzername |
| `SMTP_PASS` | SMTP-Passwort oder App-Passwort |
| `CONTACT_RECEIVER_EMAIL` | Empfängeradresse für Kontaktanfragen |
| `SMTP_FROM` | Optionaler Absender, falls der Anbieter das verlangt |
| `CONTACT_DRY_RUN` | Optional `true` für lokalen Test ohne Mailversand |

Die Besucher-E-Mail wird als `replyTo` gesetzt, damit später direkt auf die Anfrage geantwortet
werden kann.

## Deployment

### Vercel

Die aktuelle Struktur ist für Vercel gedacht:

- Angular-Frontend im Projektroot
- Kontakt-Endpunkt in `api/contact.js`
- Formular-Request an `/api/contact`

Beim Deployment müssen die oben genannten Environment Variables im Vercel-Projekt gesetzt werden.
Die Empfänger-E-Mail wird über `CONTACT_RECEIVER_EMAIL` eingetragen.

### Netlify

Netlify nutzt üblicherweise `netlify/functions` statt `api`. Für Netlify müsste die Function daher
nach `netlify/functions/contact.js` verschoben oder über eine Netlify-Weiterleitung auf
`/.netlify/functions/contact` verfügbar gemacht werden. Das Frontend kann weiterhin an
`/api/contact` senden, wenn eine passende Redirect-Regel eingerichtet ist.

## Checks

```bash
npm test
npm run build
```
