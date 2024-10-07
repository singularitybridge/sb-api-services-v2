import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';
import { createContentItem, getContentItemsByType, deleteContentItemsByType } from '../../services/content.service';
import OpenAI from 'openai';
import { ContentType } from '../../models/ContentType';
import { getCompletionResponse } from '../../services/oai.completion.service';
import { getApiKey } from '../../services/api.key.service';

export interface CodeFileSummary {
  filename: string;
  filepath: string;
  summary: string;
  lastModified: Date;
  fileSize: number;
  language: string;
  linesOfCode: number;
}

const getOrCreateContentType = async (companyId: string, name: string) => {
  let contentType = await ContentType.findOne({ companyId, name });
  if (!contentType) {
    contentType = new ContentType({
      companyId,
      name,
      fields: [
        { name: 'filename', type: 'string', required: true },
        { name: 'filepath', type: 'string', required: true },
        { name: 'summary', type: 'string', required: true },
        { name: 'lastModified', type: 'date', required: true },
        { name: 'fileSize', type: 'number', required: true },
        { name: 'language', type: 'string', required: true },
        { name: 'linesOfCode', type: 'number', required: true },
      ],
    });
    await contentType.save();
  }
  return contentType;
};

export const scanCodeProject = async (params: {
  directoryPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  companyId: string;
}): Promise<void> => {
  const { directoryPath, includePatterns, excludePatterns, maxFileSize, companyId } = params;

  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');

  const globPattern = includePatterns && includePatterns.length > 0 
    ? path.join(directoryPath, '**', `{${includePatterns.join(',')}}`)
    : path.join(directoryPath, '**', '*');

  const files: string[] = glob.sync(globPattern, {
    ignore: excludePatterns,
    nodir: true,
  });

  for (const file of files) {
    const stats = fs.statSync(file);
    if (maxFileSize && stats.size > maxFileSize) continue;

    const summary = await summarizeFile(file, companyId);
    await storeFileSummary({
      filename: path.basename(file),
      filepath: file,
      summary,
      lastModified: stats.mtime,
      fileSize: stats.size,
      language: path.extname(file).slice(1),
      linesOfCode: fs.readFileSync(file, 'utf-8').split('\n').length,
    }, companyId, contentType._id.toString());
  }
};

export const dryRunScanCodeProject = async (params: {
  directoryPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  companyId: string;
}): Promise<string[]> => {
  const { directoryPath, includePatterns, excludePatterns, maxFileSize } = params;

  const globPattern = includePatterns && includePatterns.length > 0 
    ? path.join(directoryPath, '**', `{${includePatterns.join(',')}}`)
    : path.join(directoryPath, '**', '*');

  const files: string[] = glob.sync(globPattern, {
    ignore: excludePatterns,
    nodir: true,
  });

  return files.filter(file => {
    const stats = fs.statSync(file);
    return !maxFileSize || stats.size <= maxFileSize;
  });
};

export const summarizeFile = async (filePath: string, companyId: string): Promise<string> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const systemPrompt = "You are a helpful assistant that summarizes code files.";
  const userInput = `Summarize the following code:\n\n${content}`;
  
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  return getCompletionResponse(apiKey, systemPrompt, userInput, "gpt-4o-mini");
};

export const storeFileSummary = async (summaryData: CodeFileSummary, companyId: string, contentTypeId: string): Promise<void> => {
  const result = await createContentItem(companyId, contentTypeId, summaryData, summaryData.filepath);
  if ('error' in result) {
    throw new Error(`Failed to store file summary: ${result.error}`);
  }
};

export const queryRelevantFiles = async (taskDescription: string, companyId: string, limit = 10): Promise<CodeFileSummary[]> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  const summaries = await getContentItemsByType(companyId, contentType._id.toString());
  
  const systemPrompt = "You are a helpful assistant that ranks code files based on relevance to a task.";
  const userInput = `Rank the following code file summaries based on their relevance to this task: "${taskDescription}". Respond with a JSON array of indices, most relevant first.\n\n${JSON.stringify(summaries)}`;
  
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  const response = await getCompletionResponse(apiKey, systemPrompt, userInput, "gpt-4o-mini");

  const rankedIndices = JSON.parse(response || '[]');
  return rankedIndices.slice(0, limit).map((index: number) => summaries[index].data as CodeFileSummary);
};

export const getFileContent = async (filePath: string): Promise<string> => {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  return fs.readFileSync(filePath, 'utf-8');
};

export const editAndSaveFile = async (filePath: string, newContent: string): Promise<void> => {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  fs.writeFileSync(filePath, newContent, 'utf-8');
};

export const listIndexedFiles = async (companyId: string, limit?: number): Promise<CodeFileSummary[]> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  const summaries = await getContentItemsByType(companyId, contentType._id.toString());
  return summaries.slice(0, limit).map(item => item.data as CodeFileSummary);
};

export const clearIndexedFiles = async (companyId: string): Promise<void> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  
  console.log(`Clearing indexed files for companyId: ${companyId}`);
  
  const deletedCount = await deleteContentItemsByType(companyId, contentType._id.toString());
  
  console.log(`Deleted ${deletedCount} indexed files for companyId: ${companyId}`);
};