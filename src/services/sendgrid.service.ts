import sgMail from '@sendgrid/mail';
import { getApiKey } from './api.key.service';


/// @TODO: Update the sender email address to a valid email address
/// later, we'll retrieve the sender email from the company settings
/// key-value store. e.g - getCompanySetting(companyId, 'email')

const SENDER_EMAIL = 'agent@singularitybridge.net';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sendEmail = async (companyId: string, params: EmailParams): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const apiKey = await getApiKey(companyId, 'sendgrid');
    if (!apiKey) {
      throw new Error('SendGrid API key not found');
    }

    sgMail.setApiKey(apiKey);

    const msg = {
      to: params.to,
      from: SENDER_EMAIL,
      subject: params.subject,
      text: params.text,
      html: params.html,
    };

    await sgMail.send(msg);
    console.log('Email sent successfully');
    return { success: true, message: 'Email sent successfully' };
  } catch (error: any) {
    console.error('Error sending email:', error);
    let errorMessage = 'An error occurred while sending the email';
    if (error.response && error.response.body && error.response.body.errors) {
      errorMessage = error.response.body.errors.map((err: any) => err.message).join(', ');
    }
    return { success: false, error: errorMessage };
  }
};

export const verifySendGridKey = async (key: string): Promise<boolean> => {
  try {
    sgMail.setApiKey(key);
    await sgMail.send({
      to: 'test@example.com',
      from: SENDER_EMAIL,
      subject: 'API Key Verification',
      text: 'This is a test email for API key verification.',
      html: '<p>This is a test email for API key verification.</p>',
    });
    return true;
  } catch (error) {
    console.error('Error verifying SendGrid key:', error);
    return false;
  }
};