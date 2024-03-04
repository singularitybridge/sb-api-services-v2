import { Assistant } from '../models/Assistant';
import { Company, ICompany } from '../models/Company';
import { createAssistant } from '../services/oai.assistant.service';
import { encryptCompanyData, decryptCompanyData } from './encryption.service';

export const createCompany = async (companyData: ICompany) => {
  try {
    encryptCompanyData(companyData);
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
    await newAssistant.save();

    const openAIAssistant = await createAssistant(
      defaultAssistantData.name,
      defaultAssistantData.description,
      defaultAssistantData.llmModel,
      defaultAssistantData.llmPrompt,
    );

    newAssistant.assistantId = openAIAssistant.id;
    await newAssistant.save();

    const updatedCompanyData = company.toObject();
    decryptCompanyData(updatedCompanyData);

    return updatedCompanyData;
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

export const getCompany = async (id: string) => {
  try {
    const company = await Company.findById(id);
    if (!company) {
      throw new Error('Company not found');
    }
    const companyObj = company.toObject();
    decryptCompanyData(companyObj);
    return companyObj;
  } catch (error) {
    console.error('Error retrieving company:', error);
    throw error;
  }
};

export const getCompanies = async () => {
  try {
    const companies = await Company.find();
    return companies.map((company) => {
      const companyData = company.toObject();
      decryptCompanyData(companyData);
      return companyData;
    });
  } catch (error) {
    console.error('Error retrieving companies:', error);
    throw error;
  }
};

export const updateCompany = async (id: string, data: ICompany) => {
  try {
    const company = await Company.findById(id);
    if (!company) {
      throw new Error('Company not found');
    }
    encryptCompanyData(data);
    company.set(data);
    await company.save();

    const updatedCompanyData = company.toObject();
    decryptCompanyData(updatedCompanyData);

    return updatedCompanyData;
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

export const deleteCompany = async (id: string) => {
  try {
    const company = await Company.findByIdAndDelete(id);
    if (!company) {
      throw new Error('Company not found');
    }
    return company;
  } catch (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
};
