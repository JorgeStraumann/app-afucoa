import assert from 'node:assert/strict';

const apiKey = process.env.BREVO_API_KEY || '';
const sender = process.env.RECOVERY_EMAIL_FROM || '';
const recipient = process.env.RECOVERY_TEST_RECIPIENT || '';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (apiKey.length < 24 || /\s/.test(apiKey)) throw new Error('BREVO_API_KEY no esta disponible de forma segura.');
if (!emailPattern.test(sender) || !emailPattern.test(recipient)) throw new Error('Sender o inbox de prueba invalido.');

const response = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  signal: AbortSignal.timeout(10_000),
  headers: {
    accept: 'application/json',
    'api-key': apiKey,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    sender: { email: sender, name: 'AFUCOA' },
    to: [{ email: recipient }],
    subject: 'AFUCOA recovery sandbox validation',
    textContent: 'Sandbox/drop validation. This message must not be delivered.',
    htmlContent: '<p>Sandbox/drop validation. This message must not be delivered.</p>',
    headers: { 'X-Sib-Sandbox': 'drop' },
  }),
});

assert.equal(response.status, 201, 'Brevo no acepto el request sandbox/drop.');
console.log(JSON.stringify({ provider: 'brevo', sandbox: 'drop', accepted: true, delivered: false }));
