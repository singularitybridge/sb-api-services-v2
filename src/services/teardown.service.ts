import { Company } from '../models/Company';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { Assistant } from '../models/Assistant';
import { deleteAssistant } from './assistant.service';

export async function teardownCompany(companyId: string): Promise<void> {
  // Delete users
  await User.deleteMany({ companyId });

  // Delete sessions
  await Session.deleteMany({ companyId });

  // Delete assistants
  const assistants = await Assistant.find({ companyId });
  for (const assistant of assistants) {
    await deleteAssistant(assistant._id.toString(), assistant.assistantId);
  }

  // Delete the company itself
  await Company.findByIdAndDelete(companyId);
}
