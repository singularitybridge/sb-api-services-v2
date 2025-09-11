import express, { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import {
  createJournalEntry as createJournalEntryService,
  getJournalEntries as getJournalEntriesService,
  searchJournalEntries as searchJournalEntriesService,
  getFriendlyJournalEntries as getFriendlyJournalEntriesService,
  updateJournalEntry as updateJournalEntryService,
  deleteJournalEntry as deleteJournalEntryService,
} from '../integrations/journal/journal.service';
import { IJournal } from '../models/Journal';
import { getApiKey } from '../services/api.key.service';
import { ChannelType } from '../types/ChannelType';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Added import

const router = express.Router();

// Zod Schemas for validation
const CreateEntrySchema = z.object({
  content: z.string().min(1),
  entryType: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  // userId and companyId will be taken from authenticated session, not request body
});

// TEMPORARY DEBUG SCHEMA - Original GetEntriesQuerySchema is below
// const TempDebugGetEntriesQuerySchema = z.object({
//   userId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: "Invalid userId" }),
//   companyId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: "Invalid companyId" }),
//   // Removed other fields for debugging the root path:[] Zod error
//   tags: z.preprocess((val) => (typeof val === 'string' ? val.split(',') : val), z.array(z.string()).optional()), // Keep one preprocessor
// });

const GetEntriesQuerySchema = z.object({
  sessionId: z
    .string()
    .optional()
    .refine((val: any) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid sessionId',
    }),
  entryType: z.string().optional(),
  tags: z.preprocess(
    (val: any) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).optional(),
  ),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  scope: z.enum(['user', 'company']).optional().default('user'),
  userId: z
    .string()
    .optional()
    .refine((val: any) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid userId',
    }), // Made optional
  companyId: z
    .string()
    .optional()
    .refine((val: any) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid companyId',
    }), // Made optional
});

const SearchEntriesQuerySchema = z.object({
  q: z.string().min(1),
  entryType: z.string().optional(),
  tags: z.preprocess(
    (val: any) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).optional(),
  ),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  userId: z
    .string()
    .optional()
    .refine((val: any) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid userId',
    }), // Already optional
  companyId: z
    .string()
    .optional()
    .refine((val: any) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid companyId',
    }), // Made optional
});

const UpdateEntrySchema = CreateEntrySchema.partial(); // All fields optional for PATCH

// Middleware for Zod validation error handling
const validate =
  (schema: z.ZodSchema<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method === 'GET' || req.method === 'DELETE') {
        schema.parse(req.query);
      } else {
        schema.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ errors: error.errors });
      } else {
        next(error as Error);
      }
    }
  };

// POST /entries
router.post(
  '/entries',
  validate(CreateEntrySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { content, entryType, tags, metadata } = req.body;
      // Get userId and companyId from the authenticated user's session info
      const userId = req.user?._id;
      const companyId = req.company?._id;

      if (!userId || !companyId) {
        // This should ideally be caught by auth middleware, but as a safeguard:
        return res.status(401).json({
          message: 'User or Company ID missing from authenticated session.',
        });
      }

      // API key retrieval might be handled by middleware in a real app or passed differently
      const apiKey =
        (await getApiKey(companyId.toString(), 'openai_api_key')) || '';
      const journalData: Partial<IJournal> = {
        content,
        entryType,
        tags,
        metadata,
        userId: new mongoose.Types.ObjectId(userId as string),
        companyId: new mongoose.Types.ObjectId(companyId as string),
      };
      const entry = await createJournalEntryService(
        journalData,
        apiKey,
        ChannelType.WEB,
      ); // Changed ChannelType.API to ChannelType.WEB
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  },
);

// GET /entries
router.get(
  '/entries',
  validate(GetEntriesQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let { userId, companyId, sessionId, entryType, tags, limit, scope } =
        req.query as any;

      userId = userId || req.user?._id?.toString();
      companyId = companyId || req.company?._id?.toString();

      if (!userId || !companyId) {
        return res
          .status(400)
          .json({ message: 'User ID and Company ID are required.' });
      }

      const entries = await getJournalEntriesService(
        userId,
        companyId,
        sessionId,
        entryType,
        tags,
        limit,
        scope,
      );
      res.status(200).json(entries);
    } catch (error) {
      next(error);
    }
  },
);

// GET /entries/search
router.get(
  '/entries/search',
  validate(SearchEntriesQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let { q, companyId, userId, entryType, tags, limit } = req.query as any;

      companyId = companyId || req.company?._id?.toString();
      // userId remains optional in query; if not provided, service handles company-wide search (or user-specific if req.user._id is used by service based on other logic)
      // For search, if userId is not in query, it's fine, service will search broader by default if its logic allows.
      // If userId *is* in query, it will be used. If not, req.user._id could be a fallback if desired for user-scoped search by default.
      // The current search service takes userId as optional.

      if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required.' });
      }
      if (!q) {
        // q is required by schema, but good to double check
        return res
          .status(400)
          .json({ message: "Search query 'q' is required." });
      }

      const entries = await searchJournalEntriesService(
        q,
        companyId,
        userId,
        entryType,
        tags,
        limit,
      );
      res.status(200).json(entries);
    } catch (error) {
      next(error);
    }
  },
);

// GET /entries/friendly
router.get(
  '/entries/friendly',
  validate(GetEntriesQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let { userId, companyId, sessionId, entryType, tags, limit, scope } =
        req.query as any;

      userId = userId || req.user?._id?.toString();
      companyId = companyId || req.company?._id?.toString();

      if (!userId || !companyId) {
        return res
          .status(400)
          .json({ message: 'User ID and Company ID are required.' });
      }

      const entries = await getFriendlyJournalEntriesService(
        userId,
        companyId,
        sessionId,
        entryType,
        tags,
        limit,
        scope,
      );
      res.status(200).json(entries);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /entries/:id
router.patch(
  '/entries/:id',
  validate(UpdateEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid entry ID format' });
      }
      const entry = await updateJournalEntryService(id, req.body);
      if (!entry) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      res.status(200).json(entry);
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /entries/:id
router.delete(
  '/entries/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid entry ID format' });
      }
      const success = await deleteJournalEntryService(id);
      if (!success) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
