import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, text }) {
  const from = process.env.ALERTS_FROM || 'Temple Alerts <alerts@example.com>';
  const { data, error } = await resend.emails.send({ from, to, subject, text });
  if (error) throw new Error(error.message || 'Resend send error');
  return data;
}

