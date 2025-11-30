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
  currentDate: string; // Current date in readable format
  currentDateTime: string; // Current date and time
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

  // Get current date and time
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

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
    currentDate, // e.g., "Wednesday, November 27, 2024"
    currentDateTime, // e.g., "Wednesday, November 27, 2024, 06:30 PM"
  };
};
