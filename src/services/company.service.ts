import { Assistant } from '../models/Assistant';
import { Company, ICompany, IApiKey } from '../models/Company';
import { createAssistant } from '../services/oai.assistant.service';
import { encryptData, decryptData } from './encryption.service';

const encryptCompanyData = (companyData: ICompany) => {
  companyData.api_keys.forEach((apiKey: IApiKey) => {
    const encryptedData = encryptData(apiKey.value);
    apiKey.value = encryptedData.value;
    apiKey.iv = encryptedData.iv;
    apiKey.tag = encryptedData.tag;
  });
};

const decryptCompanyData = (companyData: any) => {
  companyData.api_keys = companyData.api_keys.map((apiKey: IApiKey) => {
    return {
      key: apiKey.key,
      value: decryptData({
        value: apiKey.value,
        iv: apiKey.iv || ' ',
        tag: apiKey.tag || ' ',
      }),
    };
  });
};

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

export const getDecryptedCompany = async (id: string) => {
  try {
    const company = await Company.findById(id);
    if (!company) {
      throw new Error('Company not found');
    }
    const decryptedCompany = company.toObject();
    decryptCompanyData(decryptedCompany);
    return decryptedCompany;
  } catch (error) {
    console.error('Error retrieving decrypted company:', error);
    throw error;
  }
};

export const getCompanies = async () => {
  try {
    const companies = await Company.find();
    return companies.map((company) => {
      const companyData = company.toObject();
      // decryptCompanyData(companyData);
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
