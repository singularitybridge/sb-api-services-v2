// File: services/googleAuth.service.ts

import { OAuth2Client } from 'google-auth-library';
import { IUser, User } from '../models/User';
import { getDecryptedCompany } from './company.service';


const JWT_SECRET: string = process.env.JWT_SECRET || '';
const CLIENT_ID: string = process.env.G_CLIENT_ID || '';
const client = new OAuth2Client(CLIENT_ID);

export const googleLogin = async (token: string) => {

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload || !payload['sub'] || !payload['name'] || !payload['email']) {
            throw new Error('Invalid or incomplete ID token');
        }

        let user: IUser = await User.findOne({ googleId: payload['sub'] }) as IUser;

        if (user) {
            user.name = payload['name'];
            user.email = payload['email'];

        } else {
            // user does not yet exist - create a new user
            const isAdmin = ['rivka@singularitybridge.net', 'avi@singularitybridge.net'].includes(payload['email']);
            const role = isAdmin ? 'Admin' : 'CompanyUser';

            user = new User({
                name: payload['name'],
                email: payload['email'],
                googleId: payload['sub'],
                role: role,
                companyId: '6641c8d2f0f26fd221e916b5', // temporary companyId of default company
                identifiers: [{ key: 'email', value: payload['email'] }],
            });
        }
        await user.save();

        // Retrieve the company data
        const companyId = user.companyId;
        const companyData = await getDecryptedCompany(companyId);

        if (!companyData.token || !companyData.token.value) {
            throw new Error('Company token not found');
        }

        const sessionToken = companyData.token.value; // temporaryily return company token as session token
        // const sessionToken = jwt.sign(
        //     { userId: user._id, email: user.email, companyId: user.companyId },
        //     JWT_SECRET,
        //     { expiresIn: '1d' }
        // );

        return { user, sessionToken };
    } catch (error) {
        console.error('Google authentication failed:', error);
        throw error;
    }
}
