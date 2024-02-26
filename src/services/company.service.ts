import { Assistant } from '../models/Assistant';
import { Company, ICompany } from '../models/Company';
import { createAssistant } from '../services/oai.assistant.service';

export const createCompany = async (companyData: ICompany) => {
  const company = new Company(companyData);
  await company.save();

  const defaultAssistantData = {
    companyId: company._id,
    assistantId: 'default',
    name: `${company.name} Assistant`,
    description: `Default assistant for ${company.name}`,
    introMessage: `Welcome to ${company.name}`,
    voice: 'Polly.Emma',
    language: 'en-US',
    llmModel: 'gpt-3.5-turbo-1106',
    llmPrompt: `This is the default assistant for ${company.name}. It was created automatically when the company was created.`,
  };
  const newAssistant = new Assistant(defaultAssistantData);

  try {
    await newAssistant.save();
    const openAIAssistant = await createAssistant(
      defaultAssistantData.name,
      defaultAssistantData.description,
      defaultAssistantData.llmModel,
      defaultAssistantData.llmPrompt,
    );

    newAssistant.assistantId = openAIAssistant.id;
    await newAssistant.save();

    return company;
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 11000) {
      throw new Error(
        'Duplicate key error: an assistant with this phone number already exists.',
      );
    } else {
      throw new Error(
        `An error occurred while trying to create the assistant : ${err}`,
      );
    }
  }
};

export const getCompany = async (id: string) => {
  return Company.findById(id);
};

export const getCompanies = async () => {
  return Company.find();
};

export const updateCompany = async (id: string, data: ICompany) => {
  const company = await Company.findById(id);
  if (!company) {
    throw new Error('Company not found');
  }
  company.set(data);
  await company.save();
  return company;
};

export const deleteCompany = async (id: string) => {
  const company = await Company.findByIdAndDelete(id);
  if (!company) {
    throw new Error('Company not found');
  }
  return company;
};
