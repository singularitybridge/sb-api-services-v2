import { Action, IAction } from '../models/Action';

export const createAction = async (data: IAction) => {
  const action = new Action(data);
  await action.save();
  return action;
};

export const getAction = async (id: string) => {
  return Action.findById(id);
};

export const getActions = async () => {
  return Action.find();
};

export const updateAction = async (id: string, data: IAction) => {
  const action = await Action.findById(id);
  if (!action) {
    throw new Error('Action not found');
  }
  action.set(data);
  await action.save();
  return action;
};

export const deleteAction = async (id: string) => {
  const action = await Action.findByIdAndDelete(id);
  if (!action) {
    throw new Error('Action not found');
  }
  return action;
}
