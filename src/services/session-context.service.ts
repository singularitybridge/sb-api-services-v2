import { Session } from '../models/Session';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Assistant } from '../models/Assistant';
import { Team } from '../models/Team';

interface TeamMember {
  id: string;
  name: string;
  description: string;
  specialization: string; // Derived from name/description
}

interface TeamContext {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
}

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
  currentTeam?: TeamContext; // Team information if assistant belongs to a team
}

/**
 * Extracts specialization from assistant name or description
 * Examples: "Email Professional" → "email management"
 *           "Jira Professional" → "project management"
 */
const extractSpecialization = (name: string, description: string): string => {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('email')) return 'email management';
  if (nameLower.includes('jira')) return 'project management';
  if (nameLower.includes('twilio')) return 'communications (SMS/WhatsApp/voice)';
  if (nameLower.includes('calendar')) return 'calendar and scheduling';
  if (nameLower.includes('whatsapp')) return 'WhatsApp automation';
  if (nameLower.includes('orchestrator')) return 'task coordination';

  // Fallback: use first sentence of description
  const firstSentence = description.split('.')[0];
  return firstSentence.length > 100
    ? firstSentence.substring(0, 97) + '...'
    : firstSentence;
};

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

  // Fetch team information if assistant belongs to a team
  let currentTeam: TeamContext | undefined;
  if (assistant.teams && assistant.teams.length > 0) {
    const teamId = assistant.teams[0]; // Use first team
    const team = await Team.findById(teamId);

    if (team) {
      // Fetch all assistants in this team
      const teamAssistants = await Assistant.find({
        teams: teamId,
        companyId: company._id
      }).select('_id name description');

      // Build team member list
      const members: TeamMember[] = teamAssistants.map(member => ({
        id: member._id.toString(),
        name: member.name,
        description: member.description || '',
        specialization: extractSpecialization(member.name, member.description || '')
      }));

      currentTeam = {
        id: team._id.toString(),
        name: team.name,
        description: team.description,
        members
      };
    }
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
    currentTeam, // undefined if not in a team
  };
};
