import { getApiKey } from '../api.key.service';
import { sendEmail } from '../sendgrid.service';
import sgMail from '@sendgrid/mail';

jest.mock('@sendgrid/mail');
jest.mock('../api.key.service');

describe('SendGrid Service', () => {
  const mockCompanyId = 'test-company-id';
  const mockApiKey = 'test-api-key';
  const mockEmailParams = {
    to: 'test@example.com',
    subject: 'Test Subject',
    text: '', // Add an empty string for the 'text' property
    html: '<p>Test HTML Content</p>',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
  });

  it('should send an email successfully', async () => {
    (sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);

    const result = await sendEmail(mockCompanyId, mockEmailParams);

    expect(getApiKey).toHaveBeenCalledWith(mockCompanyId, 'sendgrid');
    expect(sgMail.setApiKey).toHaveBeenCalledWith(mockApiKey);
    expect(sgMail.send).toHaveBeenCalledWith({
      to: mockEmailParams.to,
      from: 'agent@singularitybridge.net',
      subject: mockEmailParams.subject,
      text: '',
      html: mockEmailParams.html,
    });
    expect(result).toEqual({ success: true, message: 'Email sent successfully' });
  });

  it('should handle API key not found error', async () => {
    (getApiKey as jest.Mock).mockResolvedValue(null);

    const result = await sendEmail(mockCompanyId, mockEmailParams);

    expect(getApiKey).toHaveBeenCalledWith(mockCompanyId, 'sendgrid');
    expect(sgMail.setApiKey).not.toHaveBeenCalled();
    expect(sgMail.send).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'SendGrid API key not found' });
  });

  it('should handle SendGrid API error', async () => {
    const mockError = new Error('SendGrid API Error');
    (sgMail.send as jest.Mock).mockRejectedValue(mockError);

    const result = await sendEmail(mockCompanyId, mockEmailParams);

    expect(getApiKey).toHaveBeenCalledWith(mockCompanyId, 'sendgrid');
    expect(sgMail.setApiKey).toHaveBeenCalledWith(mockApiKey);
    expect(sgMail.send).toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'SendGrid API Error' });
  });
});