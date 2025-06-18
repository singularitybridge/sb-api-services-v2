import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { ICompany, Company } from '../models/Company';
import { createCompany } from './company.service';

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const G_CLIENT_ID_ENV: string | undefined = process.env.G_CLIENT_ID;
let client: OAuth2Client | undefined;

if (G_CLIENT_ID_ENV) {
    client = new OAuth2Client(G_CLIENT_ID_ENV);
} else {
    console.warn("G_CLIENT_ID not found in environment variables. Google login will not be available.");
}

export const googleLogin = async (token: string): Promise<{ user: IUser; company: ICompany; sessionToken: string }> => {
    if (!client || !G_CLIENT_ID_ENV) {
        throw new Error('Google client not initialized. Google login is unavailable.');
    }
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: G_CLIENT_ID_ENV, // Use the env variable directly here
        });

        const payload = ticket.getPayload();

        if (!payload || !payload['sub'] || !payload['name'] || !payload['email']) {
            throw new Error('Invalid or incomplete ID token');
        }

        let user: IUser | null = await User.findOne({ googleId: payload['sub'] });
        let company: ICompany;

        if (!user) {
            // Create a new company with minimal info
            const defaultCompany: Partial<ICompany> = {
                name: `${payload['name']}'s Company`,
                description: 'New company created during Google login',
                api_keys: [],
                identifiers: [{ key: 'email', value: payload['email'] }],
            };

            company = await createCompany(defaultCompany);

            // Create a new user
            const newUser: Partial<IUser> = {
                companyId: company._id,
                name: payload['name'],
                email: payload['email'],
                googleId: payload['sub'],
                role: 'CompanyUser',
                identifiers: [{ key: 'email', value: payload['email'] }],
            };

            user = await User.create(newUser);
        } else {
            // Update existing user information
            user.email = payload['email'];
            // Only set the name if it's not already set
            if (!user.name) {
                user.name = payload['name'];
            }
            await user.save();

            const foundCompany = await Company.findById(user.companyId);
            if (!foundCompany) {
                throw new Error('Company not found for existing user');
            }
            company = foundCompany.toObject() as ICompany;
        }

        // Generate a session token
        const sessionToken = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                companyId: user.companyId 
            },
            JWT_SECRET,
            { expiresIn: '7d' } // Adjust expiration as needed
        );

        return { user, company, sessionToken };

    } catch (error) {
        console.error('Google authentication failed:', error);
        throw error;
    }
}

export const verifyBetaKey = async (betaKey: string) => {
    if (betaKey === process.env.BETA_INVITE_KEY) {
        return true;
    } else {
        return false;
    }
};
