import { createContentType } from '../../services/content.service';

export const setupCodeIndexer = async (companyId: string) => {
  await createContentType(
    companyId,
    'CodeFileSummary',
    'Summary of a code file',
    [
      { name: 'filename', type: 'string', required: true },
      { name: 'filepath', type: 'string', required: true },
      { name: 'summary', type: 'string', required: true },
      { name: 'lastModified', type: 'date', required: true },
      { name: 'fileSize', type: 'number', required: true },
      { name: 'language', type: 'string', required: true },
      { name: 'linesOfCode', type: 'number', required: true },
    ],
  );
};
