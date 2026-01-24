// File: src/services/company.service.ts
import { Types } from 'mongoose';
import {
  Company,
  ICompany,
  IApiKey,
  OnboardingStatus,
} from '../models/Company';
import { encryptData, decryptData } from './encryption.service';
import { updateOnboardingStatus } from './onboarding.service';
import { User } from '../models/User';
import { refreshApiKeyCache } from './api.key.service';

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

export const createCompany = async (
  companyData: Partial<ICompany>,
): Promise<ICompany> => {
  try {
    companyData.api_keys = companyData.api_keys || [];

    const defaultKeys = [
      { key: 'openai_api_key', value: 'default_openai_key' },
      { key: 'labs11_api_key', value: 'default_labs11_key' },
      { key: 'google_api_key', value: 'default_google_key' },
      { key: 'anthropic_api_key', value: 'default_anthropic_key' },
      { key: 'perplexity_api_key', value: 'default_perplexity_key' },
      { key: 'sendgrid_api_key', value: 'default_sendgrid_key' },
      { key: 'linear_api_key', value: 'default_linear_key' },
    ];

    defaultKeys.forEach((defaultKey) => {
      if (!companyData.api_keys!.some((key) => key.key === defaultKey.key)) {
        companyData.api_keys!.push(defaultKey);
      }
    });

    companyData.onboardingStatus = OnboardingStatus.CREATED;
    companyData.onboardedModules = [];

    encryptCompanyData(companyData as ICompany);

    const company = new Company(companyData);

    await company.save();

    const createdCompany = company.toObject();
    decryptCompanyData(createdCompany);

    // Refresh API key cache for the new company
    await refreshApiKeyCache(createdCompany._id.toString());
    console.log(
      `API key cache refreshed for new company: ${createdCompany._id}`,
    );

    return createdCompany as unknown as ICompany;
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

export const getCompanies = async (
  companyId: Types.ObjectId | null,
): Promise<any[]> => {
  try {
    if (companyId === null) {
      const companies = await Company.find();
      return companies.map((company) => company.toObject());
    } else {
      const company = await Company.findById(companyId);
      return company ? [company.toObject()] : [];
    }
  } catch (error) {
    console.error('Error retrieving companies:', error);
    throw error;
  }
};

export const updateCompany = async (id: string, data: Partial<ICompany>) => {
  try {
    if (data.api_keys) {
      encryptCompanyData(data as ICompany);
    }

    const updatedCompany = await Company.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!updatedCompany) {
      throw new Error('Company not found');
    }

    await updateOnboardingStatus(updatedCompany._id.toString());

    const updatedCompanyData = updatedCompany.toObject();
    decryptCompanyData(updatedCompanyData);

    // Refresh API key cache for the updated company
    await refreshApiKeyCache(id);
    console.log(`API key cache refreshed for updated company: ${id}`);

    return updatedCompanyData as unknown as ICompany;
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

export const updateCompanyOnboarding = async (
  id: string,
  data: { companyName: string; companyDescription: string; userName: string },
) => {
  try {
    const company = await Company.findById(id);
    if (!company) {
      throw new Error('Company not found');
    }

    company.name = data.companyName;
    company.description = data.companyDescription;

    const user = await User.findOne({ companyId: id });
    if (user) {
      user.name = data.userName;
      await user.save();
    }

    if (!company.onboardedModules.includes('company_info')) {
      company.onboardedModules.push('company_info');
    }
    await updateOnboardingStatus(company._id.toString());

    await company.save();

    const updatedCompanyData = company.toObject();
    decryptCompanyData(updatedCompanyData);

    // Refresh API key cache for the updated company
    await refreshApiKeyCache(id);
    console.log(
      `API key cache refreshed for company after onboarding update: ${id}`,
    );

    return updatedCompanyData as unknown as ICompany;
  } catch (error) {
    console.error('Error updating company onboarding information:', error);
    throw error;
  }
};
