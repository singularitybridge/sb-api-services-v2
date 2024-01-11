import { Company, ICompany } from '../models/Company';

export const createCompany = async (data: ICompany) => {
  console.log('createCompany', data);
  const company = new Company(data);
  await company.save();
  return company;
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
}