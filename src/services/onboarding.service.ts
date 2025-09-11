import { IUser, User } from '../models/User';
import { Company, ICompany, OnboardingStatus } from '../models/Company';
import { Document } from 'mongoose';
import { NotFoundError } from '../utils/errors';

const DEFAULT_ENCRYPTED_OPENAI_API_KEY = '91ac2fa32515511b3f1bb19e5e9980553115';

export const updateOnboardingStatus = async (
  companyId: string,
): Promise<ICompany> => {
  try {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    if (
      !company.api_keys.some(
        (key) =>
          key.key === 'openai_api_key' &&
          key.value !== DEFAULT_ENCRYPTED_OPENAI_API_KEY,
      )
    ) {
      company.onboardingStatus = OnboardingStatus.API_KEY_REQUIRED;
    } else {
      // If OpenAI API key is present, set status to READY_FOR_ASSISTANTS
      company.onboardingStatus = OnboardingStatus.READY_FOR_ASSISTANTS;

      // Check for further progression based on onboarded modules
      if (
        company.onboardedModules.includes('assistants') &&
        company.onboardedModules.length < 3
      ) {
        company.onboardingStatus = OnboardingStatus.USING_BASIC_FEATURES;
      } else if (
        company.onboardedModules.length >= 3 &&
        company.onboardedModules.length < 5
      ) {
        company.onboardingStatus = OnboardingStatus.ADVANCED_USER;
      } else if (company.onboardedModules.length >= 5) {
        company.onboardingStatus = OnboardingStatus.EXPERT_USER;
      }
    }

    await company.save();
    return company.toObject() as unknown as ICompany;
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    throw error;
  }
};

export const updateOnboardedModule = async (
  companyId: string,
  module: string,
) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.onboardedModules.includes(module)) {
      company.onboardedModules.push(module);
      updateOnboardingStatus(companyId);
      await company.save();
    }

    return company.toObject() as unknown as ICompany;
  } catch (error) {
    console.error('Error updating onboarded module:', error);
    throw error;
  }
};

export const getOnboardingStatus = async (
  companyId: string,
): Promise<Pick<ICompany, 'onboardingStatus' | 'onboardedModules'>> => {
  try {
    const company = await Company.findById(companyId).select(
      'onboardingStatus onboardedModules',
    );
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return {
      onboardingStatus: company.onboardingStatus,
      onboardedModules: company.onboardedModules,
    };
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    throw error;
  }
};
