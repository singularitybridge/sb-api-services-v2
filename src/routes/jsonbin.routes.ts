import express from 'express';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  readFile,
  updateFile,
  createFile,
  updateArrayElement,
  deleteArrayElement,
  insertArrayElement,
} from '../services/jsonbin.service';

const jsonbinRouter = express.Router();

jsonbinRouter.post(
  '/',
  validateApiKeys(['jsonbin_api_key']),
  express.json(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { data, name } = req.body;
      const result = await createFile(req.company._id, data, name);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error creating file in JSONBin' });
    }
  },
);

jsonbinRouter.get(
  '/:binId',
  validateApiKeys(['jsonbin_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { binId } = req.params;
      const data = await readFile(req.company._id, binId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Error reading file from JSONBin' });
    }
  },
);

jsonbinRouter.put(
  '/:binId',
  validateApiKeys(['jsonbin_api_key']),
  express.json(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { binId } = req.params;
      const data = req.body;
      const result = await updateFile(req.company._id, binId, data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error updating file in JSONBin' });
    }
  },
);

jsonbinRouter.put(
  '/:binId/:arrayKey/:elementId',
  validateApiKeys(['jsonbin_api_key']),
  express.json(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { binId, arrayKey, elementId } = req.params;
      const updateData = req.body;
      const result = await updateArrayElement(
        req.company._id,
        binId,
        arrayKey,
        elementId,
        updateData,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res
          .status(500)
          .json({ error: 'Error updating array element in JSONBin' });
      }
    }
  },
);

// New route for deleting an array element
jsonbinRouter.delete(
  '/:binId/:arrayKey/:elementId',
  validateApiKeys(['jsonbin_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { binId, arrayKey, elementId } = req.params;
      const result = await deleteArrayElement(
        req.company._id,
        binId,
        arrayKey,
        elementId,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res
          .status(500)
          .json({ error: 'Error deleting array element in JSONBin' });
      }
    }
  },
);

// New route for inserting an array element
jsonbinRouter.post(
  '/:binId/:arrayKey',
  validateApiKeys(['jsonbin_api_key']),
  express.json(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { binId, arrayKey } = req.params;
      const newElement = req.body;
      const result = await insertArrayElement(
        req.company._id,
        binId,
        arrayKey,
        newElement,
      );
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res
          .status(500)
          .json({ error: 'Error inserting array element in JSONBin' });
      }
    }
  },
);

export { jsonbinRouter };
