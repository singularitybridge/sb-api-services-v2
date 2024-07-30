// file path: /src/routes/journal.routes.ts
import express from 'express';
import {
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
} from '../services/journal.service';
import { AuthenticatedRequest, verifyAccess } from '../middleware/auth.middleware';
import { validateApiKeys } from '../services/api.key.service';

const journalRouter = express.Router();

journalRouter.post(  '/',  verifyAccess(),  validateApiKeys(['openai']),  async (req: AuthenticatedRequest, res) => {
    try {
      const journalData = {
        ...req.body,
        userId: req.user?._id,
        companyId: req.company._id,
      };
      console.log('Creating journal entry:', journalData);
      
      const newEntry = await createJournalEntry(journalData);
      res.status(201).json(newEntry);
    } catch (error) {
      console.error('Error creating journal entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

journalRouter.get(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entryType, tags } = req.query;
      const entries = await getJournalEntries(
        req.user?._id,
        req.company._id,
        entryType as string,
        tags ? (tags as string).split(',') : undefined
      );
      res.json(entries);
    } catch (error) {
      console.error('Error getting journal entries:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

journalRouter.put(
  '/:journalId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { journalId } = req.params;
      const updatedEntry = await updateJournalEntry(journalId, req.body);
      if (updatedEntry) {
        res.json(updatedEntry);
      } else {
        res.status(404).json({ error: 'Journal entry not found' });
      }
    } catch (error) {
      console.error('Error updating journal entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

journalRouter.delete(
  '/:journalId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { journalId } = req.params;
      const deleted = await deleteJournalEntry(journalId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Journal entry not found' });
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export { journalRouter };