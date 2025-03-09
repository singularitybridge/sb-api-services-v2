import { Team, ITeam } from '../models/Team';
import { Assistant } from '../models/Assistant';
import mongoose from 'mongoose';

export const getTeams = async (companyId: string): Promise<ITeam[]> => {
  try {
    const teams = await Team.find({ companyId });
    return teams;
  } catch (error) {
    console.error('Error retrieving teams:', error);
    throw new Error('Error retrieving teams');
  }
};

export const getTeamById = async (id: string): Promise<ITeam | null> => {
  try {
    const team = await Team.findById(id);
    return team;
  } catch (error) {
    console.error('Error retrieving team by id:', error);
    throw new Error('Error retrieving team by id');
  }
};

export const createTeam = async (teamData: Partial<ITeam>): Promise<ITeam> => {
  try {
    const team = new Team(teamData);
    await team.save();
    return team;
  } catch (error) {
    console.error('Error creating team:', error);
    throw new Error('Error creating team');
  }
};

export const updateTeam = async (id: string, teamData: Partial<ITeam>): Promise<ITeam | null> => {
  try {
    const team = await Team.findByIdAndUpdate(id, teamData, { new: true });
    return team;
  } catch (error) {
    console.error('Error updating team:', error);
    throw new Error('Error updating team');
  }
};

export const deleteTeam = async (id: string): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    // Remove the team from all assistants that reference it
    await Assistant.updateMany(
      { teams: id },
      { $pull: { teams: id } },
      { session }
    );
    
    // Delete the team
    await Team.findByIdAndDelete(id).session(session);
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting team:', error);
    throw new Error('Error deleting team');
  } finally {
    session.endSession();
  }
};

export const assignAssistantToTeam = async (assistantId: string, teamId: string): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    // Add team to assistant's teams array if not already present
    await Assistant.findByIdAndUpdate(
      assistantId,
      { $addToSet: { teams: teamId } },
      { session }
    );
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Error assigning assistant to team:', error);
    throw new Error('Error assigning assistant to team');
  } finally {
    session.endSession();
  }
};

export const removeAssistantFromTeam = async (assistantId: string, teamId: string): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    // Remove team from assistant's teams array
    await Assistant.findByIdAndUpdate(
      assistantId,
      { $pull: { teams: teamId } },
      { session }
    );
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing assistant from team:', error);
    throw new Error('Error removing assistant from team');
  } finally {
    session.endSession();
  }
};

export const getAssistantsByTeam = async (teamId: string): Promise<any[]> => {
  try {
    const assistants = await Assistant.find({ teams: teamId });
    return assistants;
  } catch (error) {
    console.error('Error retrieving assistants by team:', error);
    throw new Error('Error retrieving assistants by team');
  }
};
