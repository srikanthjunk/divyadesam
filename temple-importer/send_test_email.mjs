import 'dotenv/config';
import { sendEmail } from './email.mjs';

const to = process.argv[2];
if (!to) {
  console.log('Usage: node send_test_email.mjs you@example.com');
  process.exit(1);
}

const subject = 'Temple Alerts — test';
const text = `This is a plain-text test from your Temple Alerts pipeline.
If you received this, email sending is good to go.`;

sendEmail({ to, subject, text })
  .then(() => console.log('Test email sent.'))
  .catch(e => { console.error('Send failed:', e.message); process.exit(1); });

