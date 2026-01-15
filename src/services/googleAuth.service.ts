import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { ICompany, Company } from '../models/Company';
import { createCompany } from './company.service';
import * as https from 'https';

// Check if we need to force IPv6 (for Hetzner to bypass Google blocking)
// Set FORCE_IPV6=true on Hetzner servers
const forceIPv6 = process.env.FORCE_IPV6 === 'true';

// Create HTTPS agent based on environment needs
// Default: use standard networking (works for AWS and most environments)
// Hetzner: force IPv6 to bypass Google's IPv4 blocking
let httpsAgent: https.Agent | undefined;

if (forceIPv6) {
  console.log('Forcing IPv6 for Google OAuth (FORCE_IPV6=true)');
  httpsAgent = new https.Agent({
    family: 6, // Force IPv6
  });
}

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const G_CLIENT_ID_ENV: string | undefined = process.env.G_CLIENT_ID;
let client: OAuth2Client | undefined;

if (G_CLIENT_ID_ENV) {
  const clientOptions: any = {
    clientId: G_CLIENT_ID_ENV,
    redirectUri: 'postmessage',
  };

  // Only add the custom agent if we're forcing IPv6
  if (httpsAgent) {
    clientOptions.transporterOptions = {
      agent: httpsAgent,
    };
  }

  client = new OAuth2Client(clientOptions);
} else {
  console.warn(
    'G_CLIENT_ID not found in environment variables. Google login will not be available.',
  );
}

export const googleLogin = async (
  token: string,
): Promise<{ user: IUser; company: ICompany; sessionToken: string }> => {
  if (!client || !G_CLIENT_ID_ENV) {
    throw new Error(
      'Google client not initialized. Google login is unavailable.',
    );
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: G_CLIENT_ID_ENV,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload['sub'] || !payload['name'] || !payload['email']) {
      throw new Error('Invalid or incomplete ID token');
    }

    let user: IUser | null = await User.findOne({ googleId: payload['sub'] });
    let company: ICompany;

    if (!user) {
      // Check for pending invite before creating new company
      const { InviteService } = await import('./invite.service');
      const invite = await InviteService.findActiveInvite(payload['email']);

      if (invite) {
        // User has a pending invite - join the inviter's company
        const inviteCompany = await Company.findById(invite.companyId);
        if (!inviteCompany) {
          throw new Error('Invited company no longer exists');
        }

        // Use MongoDB transaction for atomic operation
        const session = await (await import('mongoose')).default.startSession();

        try {
          await session.withTransaction(async () => {
            // Create user with invited company
            const newUser: Partial<IUser> = {
              companyId: inviteCompany._id as any,
              name: payload['name'],
              email: payload['email'],
              googleId: payload['sub'],
              role: invite.role || 'CompanyUser',
              identifiers: [{ key: 'email', value: payload['email'] }],
            };

            const createdUsers = await User.create([newUser], { session });
            user = createdUsers[0];

            // Mark invite as accepted
            await InviteService.acceptInvite(invite._id.toString(), session);
          });

          company = inviteCompany.toObject() as unknown as ICompany;
          console.log(
            `User ${payload['email']} joined company via invite: ${company.name}`,
          );
        } catch (error) {
          console.error('Failed to process invite acceptance:', error);
          throw error;
        } finally {
          await session.endSession();
        }
      } else {
        // No invite found - check if auto-signup is allowed
        const allowAutoSignup = process.env.ALLOW_AUTO_SIGNUP === 'true';

        if (!allowAutoSignup) {
          throw new Error(
            'Account creation requires an invitation. Please contact your administrator for an invite.',
          );
        }

        // Auto-signup is enabled - create a new company (existing flow)
        const defaultCompany: Partial<ICompany> = {
          name: `${payload['name']}'s Company`,
          description: 'New company created during Google login',
          api_keys: [],
          identifiers: [{ key: 'email', value: payload['email'] }],
        };

        company = await createCompany(defaultCompany);

        // Create a new user
        const newUser: Partial<IUser> = {
          companyId: company._id as any,
          name: payload['name'],
          email: payload['email'],
          googleId: payload['sub'],
          role: 'CompanyUser',
          identifiers: [{ key: 'email', value: payload['email'] }],
        };

        user = await User.create(newUser);
      }
    } else {
      // Update existing user information
      user.email = payload['email'];
      if (!user.name) {
        user.name = payload['name'];
      }
      await user.save();

      const foundCompany = await Company.findById(user.companyId);
      if (!foundCompany) {
        throw new Error('Company not found for existing user');
      }
      company = foundCompany.toObject() as unknown as ICompany;
    }

    // Generate a session token
    const sessionToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        companyId: user.companyId,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    return { user, company, sessionToken };
  } catch (error: any) {
    console.error('Google authentication failed:', error.message);
    throw error;
  }
};
