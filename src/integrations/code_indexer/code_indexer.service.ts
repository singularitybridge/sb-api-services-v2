import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';
import { createContentItem, getContentItemsByType } from '../../services/content.service';
import OpenAI from 'openai';
import { ContentType } from '../../models/ContentType';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const summary = await summarizeFile(file);
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

export const summarizeFile = async (filePath: string): Promise<string> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant that summarizes code files." },
      { role: "user", content: `Summarize the following code:\n\n${content}` }
    ],
  });
  return response.choices[0].message?.content || '';
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
  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant that ranks code files based on relevance to a task." },
      { role: "user", content: `Rank the following code file summaries based on their relevance to this task: "${taskDescription}". Respond with a JSON array of indices, most relevant first.\n\n${JSON.stringify(summaries)}` }
    ],
  });

  const rankedIndices = JSON.parse(response.choices[0].message?.content || '[]');
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