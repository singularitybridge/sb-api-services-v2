// File: services/googleAuth.service.ts

import { OAuth2Client } from 'google-auth-library';
import { ISystemUser, SystemUser } from '../models/SystemUser';
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';


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

        let user:ISystemUser = await SystemUser.findOne({ googleId: payload['sub'] }) as ISystemUser;

        if (user) {
            user.name = payload['name'];
            user.email = payload['email'];

        } else {
            // user does not yet exist - create a new user
            user = new SystemUser({
                name: payload['name'],
                email: payload['email'],
                googleId: payload['sub'],
                companyId: '6641c8d2f0f26fd221e916b5' // temporary companyId of default company
            });
        }
        await user.save();
        const sessionToken = jwt.sign(
            { userId: user._id, email: user.email, companyId: user.companyId },
            JWT_SECRET,
            { expiresIn: '1d' } // expires in 1 day
        );

        return { user, sessionToken };
    } catch (error) {
        console.error('Google authentication failed:', error);
        throw error;
    }
}


export const getSystemUsers = async () => {
    try {
        const systemUsers = await SystemUser.find();
        return systemUsers.map((systemUser) => {
            const systemUserData = systemUser.toObject();
            return systemUserData;
        });
    } catch (error) {
        console.error('Error retrieving system users:', error);
        throw error;
    }
};