// file path: /src/services/oai.assistant.service.ts
import jwt, { VerifyErrors } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Company } from '../models/Company';
import { decryptData } from '../services/encryption.service';

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {

  // if origin is the UI, set the token to the admin token
  if (req.get('origin') === process.env.ADMIN_UI_URL) {
    console.log('Setting token to admin token');
       req.headers.authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55SWQiOiI2NjE1NTVmMjYxYTNmNjdlOWMwOWVjOGEiLCJpYXQiOjE3MTcwNzM5MDN9.CPcoAyAlynh26P45M62XpRphkirkqrpR--brlar9tck';
  }

  const authHeader = req.headers.authorization;
  console.log('Auth Header:  ' + authHeader);

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { companyId: string };
      console.log('decodedToken:', decodedToken);

      // Find the company with the matching token
      const company = await Company.findOne({ '_id': decodedToken.companyId });

      if (!company) {
        return res.status(403).json({ message: 'Token is not valid' });
      }

      console.log('Company found - company._id:', company._id);

      const apiKey = company.api_keys[0] as any;
      console.log('API Key:', apiKey);
      const decryptedApiKey = decryptData({ 'value': apiKey.value, 'iv': apiKey.iv, 'tag': apiKey.tag });
      console.log('Decrypted API Key:', decryptedApiKey);

      req.headers['openai-api-key'] = decryptedApiKey;


      next();
    } catch (err) {
      console.log('Error verifying token:', err);

      return res.status(403).json({ message: 'Token is not valid' });
    }
  } else {
    console.log('No auth header found');

    res.status(401).json({ message: 'Authentication token is required' });
  }
};
