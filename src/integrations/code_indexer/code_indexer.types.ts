export interface CodeFileSummary {
  filename: string;
  filepath: string;
  summary: string;
  lastModified: Date;
  fileSize: number;
  language: string;
  linesOfCode: number;
}

export interface ContentTypeField {
  name: string;
  type: string;
  required: boolean;
}

export interface ContentType {
  _id: string;
  companyId: string;
  name: string;
  fields: ContentTypeField[];
}

export interface ContentTypeModel {
  findOne(query: { companyId: string; name: string }): Promise<ContentType | null>;
  create(data: Omit<ContentType, '_id'>): Promise<ContentType>;
}

export type CodeIndexerTypes = CodeFileSummary | ContentType | ContentTypeModel;