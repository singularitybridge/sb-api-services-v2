import { User, IUser } from '../models/User';

export const findUserByIdentifier = async (
  key: string,
  value: string,
): Promise<IUser | null> => {
  try {
    return await User.findOne({ identifiers: { $elemMatch: { key, value } } });
  } catch (error) {
    console.error(`Error finding user by identifier (${key}):`, error);
    return null;
  }
};

export const findUserByIdentifierAndCompany = async (
  key: string,
  value: string,
  companyId: string,
): Promise<IUser | null> => {
  try {
    return await User.findOne({
      identifiers: { $elemMatch: { key, value } },
      companyId: companyId,
    });
  } catch (error) {
    console.error(
      `Error finding user by identifier (${key}) and company:`,
      error,
    );
    return null;
  }
};

export const createUser = async (userData: Partial<IUser>): Promise<IUser> => {
  try {
    const newUser = new User(userData);
    return await newUser.save();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const getUserById = async (userId: string): Promise<IUser | null> => {
  try {
    return await User.findById(userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
};

export const updateUser = async (
  userId: string,
  updateData: Partial<IUser>,
): Promise<IUser | null> => {
  try {
    return await User.findByIdAndUpdate(userId, updateData, { new: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const result = await User.findByIdAndDelete(userId);
    return !!result;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};
