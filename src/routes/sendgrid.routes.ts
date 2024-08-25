import express from 'express';
import { z } from 'zod';
import { sendEmail } from '../services/sendgrid.service';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const sendgridRouter = express.Router();

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
  html: z.string().min(1),
});

sendgridRouter.post('/send', validateApiKeys(['sendgrid']), express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const validatedBody = emailSchema.parse(req.body);
    const result = await sendEmail(req.company._id, validatedBody);
    
    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in SendGrid route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { sendgridRouter };
