import * as fs from 'fs';
import OpenAI from 'openai';
import { createContentItem, getContentItemsByType, deleteContentItemsByType } from '../../services/content.service';
import { getApiKey } from '../../services/api.key.service';
import { CodeFileSummary } from './code_indexer.types';
import {
  getOrCreateContentType,
  getFilesFromGlob,
  readFileContent
} from './code_indexer.utils';
import { ContentItem } from '../../models/ContentItem';

const EMBEDDING_MODEL = 'text-embedding-3-small';

type ScanCodeProjectParams = {
  directoryPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  companyId: string;
};

export const scanCodeProject = async (params: ScanCodeProjectParams): Promise<void> => {

  const { directoryPath, includePatterns, excludePatterns, companyId } = params;
  console.log(`Starting scanCodeProject for directory: ${directoryPath}`);
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  const files = getFilesFromGlob(directoryPath, includePatterns, excludePatterns);
  console.log(`Found ${files.length} files to process`);

  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) throw new Error('OpenAI API key is missing');

  const openai = new OpenAI({ apiKey });

  for (const file of files) {
    await processFile(file, openai, companyId, contentType._id);
  }
  
  console.log('scanCodeProject completed successfully');
};

const processFile = async (
  file: string,
  openai: OpenAI,
  companyId: string,
  contentTypeId: string
): Promise<void> => {
  try {
    console.log(`Processing file: ${file}`);
    const fileContent = readFileContent(file);
    const embedding = await generateEmbedding(fileContent, openai);
    
    const codeSummary: CodeFileSummary = {
      filename: file.split('/').pop() || '',
      filepath: file,
      summary: `File ${file.split('/').pop() || ''} indexed`,
      lastModified: fs.statSync(file).mtime,
      fileSize: fs.statSync(file).size,
      language: file.split('.').pop() || '',
      linesOfCode: fileContent.split('\n').length,
    };
    
    const result = await createContentItem(companyId, contentTypeId, codeSummary, file, embedding);
    if ('error' in result) {
      throw new Error(`Failed to store file summary: ${result.error}`);
    }
    console.log(`File processed successfully: ${file}`);
  } catch (error) {
    console.error(`Error processing file ${file}:`, error);
  }
};

export const  generateEmbedding = async (text: string, openai: OpenAI): Promise<number[]> => {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const queryRelevantFiles = async (
  taskDescription: string,
  companyId: string,
  limit = 10
): Promise<CodeFileSummary[]> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) throw new Error('OpenAI API key is missing');

  const openai = new OpenAI({ apiKey });
  
  const queryEmbedding = await generateEmbedding(taskDescription, openai);

  // Perform similarity search using MongoDB aggregation
  const relevantFiles = await ContentItem.aggregate([
    { $match: { companyId, contentTypeId: contentType._id } },
    {
      $addFields: {
        similarity: {
          $reduce: {
            input: { $zip: { inputs: ["$embedding", queryEmbedding] } },
            initialValue: 0,
            in: { $add: ["$$value", { $multiply: [{ $arrayElemAt: ["$$this", 0] }, { $arrayElemAt: ["$$this", 1] }] }] }
          }
        }
      }
    },
    { $sort: { similarity: -1 } },
    { $limit: limit },
    { $project: { _id: 0, data: 1, similarity: 1 } }
  ]);

  return relevantFiles.map(item => item.data as CodeFileSummary);
};

export const getFileContent = async (filePath: string): Promise<string> => {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  return readFileContent(filePath);
};

export const editAndSaveFile = async (filePath: string, newContent: string): Promise<void> => {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  fs.writeFileSync(filePath, newContent, 'utf-8');
};

export const listIndexedFiles = async (companyId: string, limit?: number): Promise<CodeFileSummary[]> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');
  const summaries = await getContentItemsByType(companyId, contentType._id);
  return summaries.slice(0, limit).map(item => item.data as CodeFileSummary);
};

export const clearIndexedFiles = async (companyId: string): Promise<void> => {
  const contentType = await getOrCreateContentType(companyId, 'CodeFileSummary');  
  const deletedCount = await deleteContentItemsByType(companyId, contentType._id);
  console.log(`Deleted ${deletedCount} indexed files for companyId: ${companyId}`);
};

export const dryRunScanCodeProject = async (params: Omit<ScanCodeProjectParams, 'companyId'>): Promise<string[]> => {
  const { directoryPath, includePatterns, excludePatterns } = params;
  return getFilesFromGlob(directoryPath, includePatterns, excludePatterns);
};