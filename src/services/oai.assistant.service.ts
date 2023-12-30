import { openaiClient } from './assistant.service';

export const getAssistants = async () => {
  const assistants = await openaiClient.beta.assistants.list({
    limit: 20,
  });
  return assistants;
};

export const getAssistantById = async (assistantId: string) => {
  const assistant = await openaiClient.beta.assistants.retrieve(assistantId);
  return assistant;
};

export const updateAssistantById = async (
  assistantId: string,
  name: string,
  description: string,
  model: string,
  instructions: string,
  //   file_ids: string[],
) => {
  const updatedAssistant = await openaiClient.beta.assistants.update(
    assistantId,
    {
      instructions,
      name,
      description,
      //   tools: [{ type: 'retrieval' }],
      model,
      //   file_ids,
    },
  );
  return updatedAssistant;
};

export const createAssistant = async (
  name: string,
  description: string,
  model: string,
  instructions: string,
) => {
  const assistant = await openaiClient.beta.assistants.create({
    name,
    description,
    instructions,
    model,
    tools: [{ type: 'retrieval' }],
  });
  return assistant;
};

export const deleteAssistantById = async (assistantId: string) => {
  const response = await openaiClient.beta.assistants.del(assistantId);
  return response.deleted;
};
