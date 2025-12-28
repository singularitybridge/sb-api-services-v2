/// file_path: src/routes/auth.routes.ts
import express from 'express';
import { extractTokenFromHeader, verifyToken } from '../services/token.service';
import { googleLogin } from '../services/googleAuth.service';
import { refreshApiKeyCache } from '../services/api.key.service';
import { ApiKeyService } from '../services/apiKey.service';

const authRouter = express.Router();

authRouter.post('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if it's an API key
    if (authHeader && authHeader.startsWith('Bearer sk_live_')) {
      const apiKey = authHeader.substring(7);
      const result = await ApiKeyService.validateApiKey(apiKey);

      if (!result) {
        return res.status(401).json({ message: 'Invalid or expired API key' });
      }

      return res.json({
        message: 'API key is valid',
        user: result.user,
        company: result.company,
        apiKeyName: result.apiKeyDoc.name,
        expiresAt: result.apiKeyDoc.expiresAt,
      });
    }

    // Otherwise, it's a JWT token
    const token = extractTokenFromHeader(authHeader);
    const { user, company, decryptedApiKey } = await verifyToken(token);

    const response: any = {
      message: 'Token is valid',
      user,
      company,
    };

    if (decryptedApiKey) {
      response.decryptedApiKey = decryptedApiKey;
    } else {
      response.message += ', but API key is not set';
    }

    res.json(response);
  } catch (error) {
    console.error('Token verification failed:', error);
    res
      .status(401)
      .json({ message: 'Invalid token', error: (error as Error).message });
  }
});

authRouter.post('/google/login', async (req, res) => {
  console.log('called google login route');
  try {
    const { user, company, sessionToken } = await googleLogin(req.body.token);
    await refreshApiKeyCache(company._id.toString());
    res.json({ user, company, sessionToken });
  } catch (error) {
    console.error('Error during Google login:', error);
    res.status(500).json({ error: 'Failed to login with Google' });
  }
});

export { authRouter };
