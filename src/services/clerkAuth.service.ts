import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { ICompany, Company } from '../models/Company';
import { createCompany } from './company.service';

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const CLERK_SECRET_KEY: string | undefined = process.env.CLERK_SECRET_KEY;

// Allowed origins for Clerk JWT verification
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://app.singularitybridge.net',
];

let clerkClient: ReturnType<typeof createClerkClient> | undefined;

if (CLERK_SECRET_KEY) {
  clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  console.log('Clerk client initialized');
} else {
  console.warn(
    'CLERK_SECRET_KEY not found in environment variables. Clerk login will not be available.',
  );
}

export const clerkLogin = async (
  clerkToken: string,
): Promise<{ user: IUser; company: ICompany; sessionToken: string }> => {
  if (!clerkClient || !CLERK_SECRET_KEY) {
    throw new Error('Clerk client not initialized. Clerk login is unavailable.');
  }

  try {
    // Verify the Clerk JWT token
    // authorizedParties should be the origins where the frontend is hosted
    const verifiedToken = await verifyToken(clerkToken, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: ALLOWED_ORIGINS,
    });

    const clerkUserId = verifiedToken.sub;

    if (!clerkUserId) {
      throw new Error('Invalid Clerk token: missing user ID');
    }

    // Get the full user details from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    if (!clerkUser) {
      throw new Error('Could not fetch user from Clerk');
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const name =
      `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
      email?.split('@')[0] ||
      'User';

    if (!email) {
      throw new Error('User email not available from Clerk');
    }

    // Find existing user by Clerk ID or email
    let user: IUser | null = await User.findOne({
      $or: [{ clerkId: clerkUserId }, { email: email }],
    });

    let company: ICompany;

    if (!user) {
      // Check for pending invite before creating new company
      const { InviteService } = await import('./invite.service');
      const invite = await InviteService.findActiveInvite(email);

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
              name: name,
              email: email,
              clerkId: clerkUserId,
              role: invite.role || 'CompanyUser',
              identifiers: [{ key: 'email', value: email }],
            };

            const createdUsers = await User.create([newUser], { session });
            user = createdUsers[0];

            // Mark invite as accepted
            await InviteService.acceptInvite(invite._id.toString(), session);
          });

          company = inviteCompany.toObject() as unknown as ICompany;
          console.log(`User ${email} joined company via invite: ${company.name}`);
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

        // Auto-signup is enabled - create a new company
        const defaultCompany: Partial<ICompany> = {
          name: `${name}'s Company`,
          description: 'New company created during Clerk login',
          api_keys: [],
        };

        company = await createCompany(defaultCompany);

        // Create a new user
        const newUser: Partial<IUser> = {
          companyId: company._id as any,
          name: name,
          email: email,
          clerkId: clerkUserId,
          role: 'CompanyUser',
          identifiers: [{ key: 'email', value: email }],
        };

        user = await User.create(newUser);
      }
    } else {
      // Update existing user information
      user.email = email;
      if (!user.name) {
        user.name = name;
      }
      // Update clerkId if migrating from Google OAuth
      if (!user.clerkId) {
        user.clerkId = clerkUserId;
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
        userId: user!._id,
        email: user!.email,
        companyId: user!.companyId,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    return { user: user!, company, sessionToken };
  } catch (error: any) {
    console.error('Clerk authentication failed:', error.message);
    throw error;
  }
};
