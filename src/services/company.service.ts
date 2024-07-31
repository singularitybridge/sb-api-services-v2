// File: src/services/company.service.ts
import { Types } from 'mongoose';
import { Company, ICompany, IApiKey } from '../models/Company';
import { encryptData, decryptData } from './encryption.service';
import jwt from 'jsonwebtoken';

const generateToken = () => {
  return jwt.sign({}, process.env.JWT_SECRET as string);
};


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


export const createCompany = async (companyData: Partial<ICompany>): Promise<ICompany> => {
  try {
    const token = generateToken();
    companyData.token = { value: token };

    // If identifiers are not provided, set it to an empty array
    if (!companyData.identifiers || companyData.identifiers.length === 0) {
      companyData.identifiers = [];
    }

    encryptCompanyData(companyData as ICompany);

    const company = new Company(companyData);
    await company.save();

    const createdCompany = company.toObject();
    decryptCompanyData(createdCompany);

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

export const getCompanies = async (companyId: Types.ObjectId | null): Promise<any[]> => {
  try {
    if (companyId === null) {
      // If no companyId is provided (admin user), return all companies
      const companies = await Company.find();
      return companies.map((company) => company.toObject());
    } else {
      // If a companyId is provided (regular user), return only that company
      const company = await Company.findById(companyId);
      return company ? [company.toObject()] : [];
    }
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

    const newToken = generateToken();

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
