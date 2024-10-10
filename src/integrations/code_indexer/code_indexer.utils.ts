import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';
import { Types } from 'mongoose';
import { CodeFileSummary } from './code_indexer.types';
import { ContentType, IContentType, IFieldDefinition } from '../../models/ContentType';

export const getOrCreateContentType = async (companyId: string, name: string): Promise<IContentType> => {
  const existingContentType = await ContentType.findOne({ companyId, name }).exec();
  if (existingContentType) {
    return existingContentType;
  }

  const fields: IFieldDefinition[] = [
    { name: 'filename', type: 'string', required: true },
    { name: 'filepath', type: 'string', required: true },
    { name: 'summary', type: 'string', required: true },
    { name: 'lastModified', type: 'date', required: true },
    { name: 'fileSize', type: 'number', required: true },
    { name: 'language', type: 'string', required: true },
    { name: 'linesOfCode', type: 'number', required: true },
    { name: 'embedding', type: 'array', required: true },
  ];

  return ContentType.create({
    companyId: new Types.ObjectId(companyId),
    name,
    fields,
  });
};

export const getFilesFromGlob = (directoryPath: string, includePatterns?: string[], excludePatterns?: string[]): string[] => {
  const globPattern = includePatterns?.length
    ? path.join(directoryPath, '**', `{${includePatterns.join(',')}}`)
    : path.join(directoryPath, '**', '*');

  return glob.sync(globPattern, {
    ignore: excludePatterns,
    nodir: true,
  });
};

export const getFileStats = (filePath: string): { size: number; mtime: Date } => {
  const { size, mtime } = fs.statSync(filePath);
  return { size, mtime };
};

export const readFileContent = (filePath: string): string =>
  fs.readFileSync(filePath, 'utf-8');

export const writeFileContent = (filePath: string, content: string): void =>
  fs.writeFileSync(filePath, content, 'utf-8');

export const validateCodeFileSummary = (summary: CodeFileSummary): string | null => {
  if (!summary.filename || typeof summary.filename !== 'string') {
    return 'Invalid or missing filename';
  }
  if (!summary.filepath || typeof summary.filepath !== 'string') {
    return 'Invalid or missing filepath';
  }
  if (!summary.summary || typeof summary.summary !== 'string') {
    return 'Invalid or missing summary';
  }
  if (!(summary.lastModified instanceof Date)) {
    return 'Invalid or missing lastModified date';
  }
  if (typeof summary.fileSize !== 'number' || summary.fileSize < 0) {
    return 'Invalid or missing fileSize';
  }
  if (!summary.language || typeof summary.language !== 'string') {
    return 'Invalid or missing language';
  }
  if (typeof summary.linesOfCode !== 'number' || summary.linesOfCode < 0) {
    return 'Invalid or missing linesOfCode';
  }
  return null;
};
