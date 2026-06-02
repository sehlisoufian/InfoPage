const net = require('node:net');
const tls = require('node:tls');

const MAX_MESSAGE_LENGTH = 3000;
const SMTP_TIMEOUT_MS = 10000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function contactHandler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(request);
    const payload = normalizePayload(body);
    const validationErrors = validatePayload(payload);

    if (validationErrors.length > 0) {
      return sendJson(response, 400, { error: validationErrors[0] });
    }

    if (process.env.CONTACT_DRY_RUN === 'true') {
      return sendJson(response, 200, {
        message: 'Nachricht wurde im Testmodus angenommen.',
        dryRun: true,
      });
    }

    const missingConfig = getMissingMailConfig();

    if (missingConfig.length > 0) {
      console.error(`Missing contact form environment variables: ${missingConfig.join(', ')}`);
      return sendJson(response, 500, { error: 'Der Mailversand ist noch nicht konfiguriert.' });
    }

    await sendSmtpMail(payload);

    return sendJson(response, 200, { message: 'Nachricht wurde erfolgreich gesendet.' });
  } catch (error) {
    console.error('Contact form request failed:', error);

    if (error && error.message === 'Request body must be valid JSON.') {
      return sendJson(response, 400, { error: 'Die Anfrage muss gültiges JSON enthalten.' });
    }

    return sendJson(response, 500, { error: 'Die Nachricht konnte nicht gesendet werden.' });
  }
};

async function readJsonBody(request) {
  if (request.body) {
    return typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;

      if (rawBody.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(rawBody || '{}'));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });

    request.on('error', reject);
  });
}

function normalizePayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  return {
    name: normalizeString(source.name).slice(0, 100),
    email: normalizeString(source.email),
    message: normalizeString(source.message),
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.email) {
    errors.push('Bitte geben Sie eine E-Mail-Adresse ein.');
  } else if (!EMAIL_PATTERN.test(payload.email)) {
    errors.push('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
  }

  if (!payload.message) {
    errors.push('Bitte schreiben Sie eine Nachricht.');
  } else if (payload.message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Die Nachricht darf maximal ${MAX_MESSAGE_LENGTH} Zeichen lang sein.`);
  }

  return errors;
}

function getMissingMailConfig() {
  return ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_RECEIVER_EMAIL'].filter(
    (key) => !process.env[key],
  );
}

async function sendSmtpMail(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const secure = port === 465;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const fromAddress = extractEmailAddress(from);
  const receiver = process.env.CONTACT_RECEIVER_EMAIL;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  const socket = await openSmtpSocket(host, port, secure);
  const smtp = createSmtpSession(socket);

  await smtp.expect([220]);
  let hello = await smtp.sendCommand('EHLO localhost', [250]);

  if (!secure && hello.includes('STARTTLS')) {
    await smtp.sendCommand('STARTTLS', [220]);
    const secureSocket = await upgradeToTls(smtp.socket, host);
    smtp.replaceSocket(secureSocket);
    hello = await smtp.sendCommand('EHLO localhost', [250]);
  }

  await smtp.sendCommand(
    `AUTH PLAIN ${Buffer.from(`\0${process.env.SMTP_USER}\0${process.env.SMTP_PASS}`).toString('base64')}`,
    [235],
  );
  await smtp.sendCommand(`MAIL FROM:<${fromAddress}>`, [250]);
  await smtp.sendCommand(`RCPT TO:<${receiver}>`, [250, 251]);
  await smtp.sendCommand('DATA', [354]);
  await smtp.sendData(buildEmailMessage(payload, from, receiver));
  await smtp.sendCommand('QUIT', [221]);
  smtp.end();
}

function openSmtpSocket(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));

    socket.setEncoding('utf8');
    socket.setTimeout(SMTP_TIMEOUT_MS, () => {
      socket.destroy(new Error('SMTP connection timed out.'));
    });
    socket.once('error', reject);
  });
}

function upgradeToTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));

    secureSocket.setEncoding('utf8');
    secureSocket.setTimeout(SMTP_TIMEOUT_MS, () => {
      secureSocket.destroy(new Error('SMTP TLS connection timed out.'));
    });
    secureSocket.once('error', reject);
  });
}

function createSmtpSession(initialSocket) {
  let socket = initialSocket;
  let buffer = '';
  let currentLines = [];
  let waiting = null;
  const queuedResponses = [];

  attachSocket(socket);

  return {
    get socket() {
      return socket;
    },
    replaceSocket(nextSocket) {
      socket = nextSocket;
      attachSocket(socket);
    },
    expect(expectedCodes) {
      return waitForResponse(expectedCodes);
    },
    sendCommand(command, expectedCodes) {
      const response = waitForResponse(expectedCodes);
      socket.write(`${command}\r\n`);
      return response;
    },
    sendData(content) {
      const response = waitForResponse([250]);
      socket.write(`${dotStuff(content)}\r\n.\r\n`);
      return response;
    },
    end() {
      socket.end();
    },
  };

  function attachSocket(nextSocket) {
    nextSocket.on('data', (chunk) => {
      buffer += chunk;
      drainResponses();
    });
    nextSocket.on('error', (error) => {
      if (waiting) {
        waiting.reject(error);
        waiting = null;
      }
    });
  }

  function drainResponses() {
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!/^\d{3}[\s-]/.test(line)) {
        continue;
      }

      currentLines.push(line);

      if (/^\d{3} /.test(line)) {
        queuedResponses.push(currentLines.join('\n'));
        currentLines = [];
      }
    }

    resolveQueuedResponse();
  }

  function waitForResponse(expectedCodes) {
    const queued = queuedResponses.shift();

    if (queued) {
      return Promise.resolve(assertExpectedResponse(queued, expectedCodes));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiting = null;
        reject(new Error('SMTP response timed out.'));
      }, SMTP_TIMEOUT_MS);

      waiting = {
        expectedCodes,
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
    });
  }

  function resolveQueuedResponse() {
    if (!waiting || queuedResponses.length === 0) {
      return;
    }

    const response = queuedResponses.shift();

    try {
      waiting.resolve(assertExpectedResponse(response, waiting.expectedCodes));
    } catch (error) {
      waiting.reject(error);
    } finally {
      waiting = null;
    }
  }
}

function assertExpectedResponse(response, expectedCodes) {
  const code = Number(response.slice(0, 3));

  if (!expectedCodes.includes(code)) {
    throw new Error(`Unexpected SMTP response: ${response}`);
  }

  return response;
}

function buildEmailMessage(payload, from, receiver) {
  const subject = buildSubject(payload.name);
  const body = buildTextMessage(payload);

  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(receiver)}`,
    `Reply-To: ${sanitizeHeader(payload.email)}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    `Date: ${new Date().toUTCString()}`,
    '',
    body,
  ].join('\r\n');
}

function buildSubject(name) {
  return name ? `Neue Kontaktanfrage von ${name}` : 'Neue Kontaktanfrage';
}

function buildTextMessage(payload) {
  return [
    'Neue Kontaktanfrage über die Tagesmutter-Infoseite',
    '',
    `Name: ${payload.name || 'Nicht angegeben'}`,
    `E-Mail: ${payload.email}`,
    '',
    'Nachricht:',
    payload.message,
  ].join('\n');
}

function dotStuff(content) {
  return content
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function extractEmailAddress(value) {
  const match = normalizeString(value).match(/<([^>]+)>/);
  return match ? match[1].trim() : normalizeString(value);
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function sanitizeHeader(value) {
  return normalizeString(value).replace(/[\r\n]+/g, ' ');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}
