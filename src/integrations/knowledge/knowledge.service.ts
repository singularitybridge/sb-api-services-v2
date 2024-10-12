import { ActionContext } from '../actions/types';

export const searchFiles = async (
  context: ActionContext,
  params: any
): Promise<{ success: boolean; data?: any }> => {
  // This is a mock implementation
  console.log('Mock searchFiles called with params:', params);

  // Simulate a successful search
  return {
    success: true,
    data: {
      results: [
        { fileName: 'document1.pdf', relevance: 0.95 },
        { fileName: 'document2.docx', relevance: 0.87 },
        { fileName: 'document3.txt', relevance: 0.75 },
      ],
    },
  };
};
