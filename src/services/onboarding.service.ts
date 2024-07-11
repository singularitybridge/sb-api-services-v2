import { IUser, User } from '../models/User';
import { ICompany } from '../models/Company';
import { createCompany, getDecryptedCompany, refreshCompanyToken } from './company.service';

export const handleOnboarding = async (user: any, name: string, description: string) => {
    try {
        
        console.log('Starting onboarding process');
        console.log('Received user:', user);
        console.log('Company name and description:', name, description);

        
        // Create new company for user with default values
        const defaultCompany: ICompany = {
            name: `${name}`,
            api_keys: [
                { key: 'openai_api_key', value: 'defaultValue' },
                { key: 'gcp_key', value: 'defaultValue' },
                { key: 'labs11_api_key', value: 'defaultValue' },
                { key: 'twilio_account_sid', value: 'defaultValue' },
                { key: 'twilio_auth_token', value: 'defaultValue' },
            ],
            identifiers: [{ key: 'email', value: user.email }],
            __v: 0,
        } as ICompany;

        console.log('Default company object:', defaultCompany);

        
        // Create the company using the company service
        const newCompany = await createCompany('defaultApiKey', defaultCompany as ICompany);
        console.log('New company created:', newCompany);

        // Create new user
        const newUser = {
            name: user.given_name,
            email: user.email,
            googleId: user.sub,
            role: 'CompanyUser',
            identifiers: [{ key: 'email', value: user.email }],
        } as IUser;

        console.log('New user object:', newUser);

        // Create the user using the User model
        const createdUser = await User.create(newUser);
        console.log('New user created:', createdUser);

        // decrypt the token for the new company
        const token = newCompany.token?.value || ' ';
        console.log('Token:', token);
        
        
        console.log('Onboarding process completed successfully');

        return {
            user: createdUser,
            company: newCompany,
            token: token,
        };
    } catch (error) {
        console.error('Error during onboarding:', error);
        throw error;
    }
};
