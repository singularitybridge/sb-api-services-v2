import { Session } from '../models/Session';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Assistant } from '../models/Assistant';

export interface SessionContextData {
  user: {
    name: string;
    email: string;
    // Add other user properties as needed
  };
  company: {
    name: string;
    // Add other company properties as needed
  };
  assistant: {
    name: string;
    // Add other assistant properties as needed
  };
  currentDate: string; // Current date in ISO format
  currentDateFormatted: string; // Human-readable format
}

export const getSessionContextData = async (
  sessionId: string,
): Promise<SessionContextData> => {
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

  const assistant = await Assistant.findById(session.assistantId);
  if (!assistant) {
    throw new Error('Assistant not found');
  }

  const now = new Date();

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
    assistant: {
      name: assistant.name,
      // Add other assistant properties as needed
    },
    currentDate: now.toISOString().split('T')[0], // YYYY-MM-DD format
    currentDateFormatted: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), // e.g., "Tuesday, November 26, 2025"
  };
};
