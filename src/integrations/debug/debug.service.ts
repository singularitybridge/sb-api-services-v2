import { Session } from '../../models/Session';
import { getUserById } from '../../services/user.service';
import { getCompany } from '../../services/company.service';

export const getSessionInfo = async (sessionId: string, companyId: string): Promise<{ success: boolean; markdown?: string; error?: string }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const user = await getUserById(session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const company = await getCompany(companyId);

    const info = {
      sessionId,
      userId: user._id.toString(),
      userName: user.name,
      companyId: company._id.toString(),
      companyName: company.name,
    };

    const markdown = `
| Property    | Value                |
|-------------|----------------------|
| Session ID  | ${info.sessionId}    |
| User ID     | ${info.userId}       |
| User Name   | ${info.userName}     |
| Company ID  | ${info.companyId}    |
| Company Name| ${info.companyName}  |
    `;

    return { success: true, markdown };
  } catch (error: any) {
    console.error('Error in getSessionInfo:', error);
    return { success: false, error: error.message || 'An error occurred' };
  }
};

export const verifyApiKey = async (_key: string): Promise<boolean> => {
  // Debug integration doesn't require API key verification
  return true;
};