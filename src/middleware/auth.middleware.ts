import jwt, { VerifyErrors } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Bypass token verification if the request is from admin UI's origin
  if (req.get('origin') === process.env.ADMIN_UI_URL) {
    return next();
  }

  const authHeader = req.headers.authorization;
  console.log(authHeader);

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(
      token,
      process.env.JWT_SECRET as string,
      (err: VerifyErrors | null) => {
        if (err) {
          return res.status(403).json({ message: 'Token is not valid' });
        }

        next();
      },
    );
  } else {
    res.status(401).json({ message: 'Authentication token is required' });
  }
};
