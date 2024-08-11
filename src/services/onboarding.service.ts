/// file_path: src/services/onboarding.service.ts
import { IUser, User } from '../models/User';
import { Company, ICompany, OnboardingStatus } from '../models/Company';
import { Document } from 'mongoose';

export const updateOnboardingStatus = (company: ICompany) => {
  if (!company.api_keys.some(key => key.key === 'openai_api_key' && key.value !== 'default_openai_key')) {
    company.onboardingStatus = OnboardingStatus.API_KEY_REQUIRED;
  } else if (company.onboardedModules.length === 0) {
    company.onboardingStatus = OnboardingStatus.READY_FOR_ASSISTANTS;
  } else if (company.onboardedModules.includes('assistants') && company.onboardedModules.length < 3) {
    company.onboardingStatus = OnboardingStatus.USING_BASIC_FEATURES;
  } else if (company.onboardedModules.length >= 3 && company.onboardedModules.length < 5) {
    company.onboardingStatus = OnboardingStatus.ADVANCED_USER;
  } else if (company.onboardedModules.length >= 5) {
    company.onboardingStatus = OnboardingStatus.EXPERT_USER;
  }
};

export const updateOnboardedModule = async (companyId: string, module: string) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.onboardedModules.includes(module)) {
      company.onboardedModules.push(module);
      updateOnboardingStatus(company.toObject() as ICompany);
      await company.save();
    }

    return company.toObject() as ICompany;
  } catch (error) {
    console.error('Error updating onboarded module:', error);
    throw error;
  }
};
