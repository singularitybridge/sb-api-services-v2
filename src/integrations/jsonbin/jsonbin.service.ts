import {
  readFile,
  updateFile,
  createFile,
  updateArrayElement,
  deleteArrayElement,
  insertArrayElement,
  cloneJsonbin,
} from '../../services/jsonbin.service';

export const jsonbinService = {
  createFile: async (
    companyId: string,
    data: Record<string, any>,
    name: string,
  ) => {
    try {
      await createFile(companyId, data, name);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while creating the file',
      };
    }
  },

  updateFile: async (
    companyId: string,
    binId: string,
    data: Record<string, any>,
  ) => {
    try {
      await updateFile(companyId, binId, data);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while updating the file',
      };
    }
  },

  readFile: async (companyId: string, binId: string) => {
    try {
      const result = await readFile(companyId, binId);
      return { success: true, data: result };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while reading the file',
      };
    }
  },

  updateArrayElement: async (
    companyId: string,
    binId: string,
    arrayKey: string,
    elementId: string,
    updateData: Record<string, any>,
    useMerge: boolean = false,
  ) => {
    try {
      await updateArrayElement(
        companyId,
        binId,
        arrayKey,
        elementId,
        updateData,
        useMerge,
      );
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.message || 'An error occurred while updating the array element',
      };
    }
  },

  deleteArrayElement: async (
    companyId: string,
    binId: string,
    arrayKey: string,
    elementId: string,
  ) => {
    try {
      await deleteArrayElement(companyId, binId, arrayKey, elementId);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.message || 'An error occurred while deleting the array element',
      };
    }
  },

  insertArrayElement: async (
    companyId: string,
    binId: string,
    arrayKey: string,
    newElement: Record<string, any>,
  ) => {
    try {
      await insertArrayElement(companyId, binId, arrayKey, newElement);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.message ||
          'An error occurred while inserting the array element',
      };
    }
  },

  cloneFile: async (companyId: string, binId: string) => {
    try {
      const clonedBinId = await cloneJsonbin(companyId, binId);
      return { success: true, clonedBinId };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while cloning the file',
      };
    }
  },
};
