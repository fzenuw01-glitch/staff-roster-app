import { Resend } from 'resend';

export async function sendEmailNotification({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is missing');
    return { success: false, error: 'API key missing' };
  }

  const resend = new Resend(apiKey);

  try {
    const data = await resend.emails.send({
      from: 'Pay & Sleep <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error };
  }
}