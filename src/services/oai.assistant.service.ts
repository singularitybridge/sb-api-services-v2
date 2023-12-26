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
  model: string,
  instructions: string,
//   name: string,
//   file_ids: string[],
) => {
  const updatedAssistant = await openaiClient.beta.assistants.update(
    assistantId,
    {
      instructions,
    //   name,
    //   tools: [{ type: 'retrieval' }],
      model,
    //   file_ids,
    },
  );
  return updatedAssistant;
};
