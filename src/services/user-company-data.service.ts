import { Session } from '../models/Session';
import { User } from '../models/User';
import { Company } from '../models/Company';

export interface UserCompanyData {
  user: {
    name: string;
    email: string;
    // Add other user properties as needed
  };
  company: {
    name: string;
    // Add other company properties as needed
  };
}

export const getUserCompanyData = async (sessionId: string): Promise<UserCompanyData> => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const user = await User.findById(session.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const company = await Company.findById(user.companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  return {
    user: {
      name: user.name,
      email: user.email,
      // Add other user properties as needed
    },
    company: {
      name: company.name,
      // Add other company properties as needed
    },
  };
};