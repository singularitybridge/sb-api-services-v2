import { readFile, updateFile, createFile, updateArrayElement, deleteArrayElement, insertArrayElement, cloneJsonbin } from '../../services/jsonbin.service';

// Debug logging function
const DEBUG = process.env.DEBUG === 'true';
const debug = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(`[JSONBinService] ${message}`, ...args);
  }
};

export const jsonbinService = {
  createFile: async (companyId: string, data: Record<string, any>, name: string) => {
    debug('createFile called with arguments:', { companyId, data, name });
    try {
      await createFile(companyId, data, name);
      return { success: true };
    } catch (error: any) {
      debug('Error in createFile:', error);
      return { success: false, error: error.message || 'An error occurred while creating the file' };
    }
  },

  updateFile: async (companyId: string, binId: string, data: Record<string, any>) => {
    debug('updateFile called with arguments:', { companyId, binId, data });
    try {
      await updateFile(companyId, binId, data);
      return { success: true };
    } catch (error: any) {
      debug('Error in updateFile:', error);
      return { success: false, error: error.message || 'An error occurred while updating the file' };
    }
  },

  readFile: async (companyId: string, binId: string) => {
    debug('readFile called with arguments:', { companyId, binId });
    try {
      const result = await readFile(companyId, binId);
      return { success: true, data: result };
    } catch (error: any) {
      debug('Error in readFile:', error);
      return { success: false, error: error.message || 'An error occurred while reading the file' };
    }
  },

  updateArrayElement: async (companyId: string, binId: string, arrayKey: string, elementId: string, updateData: Record<string, any>, useMerge: boolean = false) => {
    debug('updateArrayElement called with arguments:', { companyId, binId, arrayKey, elementId, updateData, useMerge });
    try {
      await updateArrayElement(companyId, binId, arrayKey, elementId, updateData, useMerge);
      return { success: true };
    } catch (error: any) {
      debug('Error in updateArrayElement:', error);
      return { success: false, error: error.message || 'An error occurred while updating the array element' };
    }
  },

  deleteArrayElement: async (companyId: string, binId: string, arrayKey: string, elementId: string) => {
    debug('deleteArrayElement called with arguments:', { companyId, binId, arrayKey, elementId });
    try {
      await deleteArrayElement(companyId, binId, arrayKey, elementId);
      return { success: true };
    } catch (error: any) {
      debug('Error in deleteArrayElement:', error);
      return { success: false, error: error.message || 'An error occurred while deleting the array element' };
    }
  },

  insertArrayElement: async (companyId: string, binId: string, arrayKey: string, newElement: Record<string, any>) => {
    debug('insertArrayElement called with arguments:', { companyId, binId, arrayKey, newElement });
    try {
      await insertArrayElement(companyId, binId, arrayKey, newElement);
      return { success: true };
    } catch (error: any) {
      debug('Error in insertArrayElement:', error);
      return { success: false, error: error.message || 'An error occurred while inserting the array element' };
    }
  },

  cloneFile: async (companyId: string, binId: string) => {
    debug('cloneFile called with arguments:', { companyId, binId });
    try {
      const clonedBinId = await cloneJsonbin(companyId, binId);
      return { success: true, clonedBinId };
    } catch (error: any) {
      debug('Error in cloneFile:', error);
      return { success: false, error: error.message || 'An error occurred while cloning the file' };
    }
  },
};