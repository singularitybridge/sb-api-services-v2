// file path: /src/services/company.service.ts
import { Assistant } from '../models/Assistant';
import { Token, Company, ICompany, IApiKey } from '../models/Company';
import { createAssistant } from '../services/oai.assistant.service';
import { encryptData, decryptData } from './encryption.service';
import jwt from 'jsonwebtoken';

const encryptCompanyData = (companyData: ICompany) => {
  companyData.api_keys.forEach((apiKey: IApiKey) => {
    const encryptedData = encryptData(apiKey.value);
    apiKey.value = encryptedData.value;
    apiKey.iv = encryptedData.iv;
    apiKey.tag = encryptedData.tag;
  });

  if (companyData.token?.value) {
    const encryptedToken = encryptData(companyData.token.value);
    companyData.token.value = encryptedToken.value;
    companyData.token.iv = encryptedToken.iv;
    companyData.token.tag = encryptedToken.tag;
  }
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

  if (companyData.token) {
    companyData.token.value = decryptData({
      value: companyData.token.value,
      iv: companyData.token.iv || ' ',
      tag: companyData.token.tag || ' ',
    });
  }
};

const generateToken = (companyId: string) => {
  console.log('generateToken:  ' + companyId);

  return jwt.sign({ companyId: companyId }, process.env.JWT_SECRET as string);
};

export const createCompany = async (apiKey: string, companyData: ICompany) => {
  try {
    let token = generateToken(companyData._id);
    companyData.token = { value: token };
    console.log('companyData.token:  ' + companyData.token.value);


    encryptCompanyData(companyData);

    const company = new Company(companyData);
    await company.save();

    const tempCompany: ICompany = company.toObject();
    token = generateToken(company._id.toString());
    //
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { companyId: string };
    console.log('decoded Token after creation:', decodedToken);

    decryptCompanyData(tempCompany);
    tempCompany.token = { value: token };
    const updatedCompany = await updateCompany(company._id.toString(), tempCompany);

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
      apiKey,
      defaultAssistantData.name,
      defaultAssistantData.description,
      defaultAssistantData.llmModel,
      defaultAssistantData.llmPrompt,
    );

    newAssistant.assistantId = openAIAssistant.id;
    await newAssistant.save();

    return updatedCompany;
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
    console.log('Company.Service ---------data.token:  ' + data.token);

    if (typeof data.token === 'string') {
      data.token = { value: data.token || '' };
    }

    console.log('Auth.Middleware --------- data.token.value:  ' + data.token?.value);

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

export const refreshCompanyToken = async (id: string, data: ICompany) => {
  try {
    const company = await Company.findById(id);
    if (!company) {
      throw new Error('Company not found');
    }

    const newToken = generateToken(id);

    if (data.token) {
      data.token = { value: newToken };
    }

    const updatedCompanyData = (await updateCompany(
      id,
      data,
    )) as unknown as ICompany;

    console.log('new token generated');
    return updatedCompanyData;
  } catch (error) {
    console.error('Error refreshing company token:', error);
    throw error;
  }
};
