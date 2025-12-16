/**
 * Nylas Integration - Shared Type Definitions
 *
 * All TypeScript interfaces and types used across Nylas services
 */

// ==========================================
// Email Types
// ==========================================

export interface NylasEmailRecipient {
  email: string;
  name?: string;
}

export interface NylasEmail {
  id: string;
  from: NylasEmailRecipient[];
  to: NylasEmailRecipient[];
  cc?: NylasEmailRecipient[];
  bcc?: NylasEmailRecipient[];
  subject: string;
  body: string;
  snippet: string;
  date: number;
  unread: boolean;
  thread_id: string;
}

// ==========================================
// Calendar Types
// ==========================================

export interface NylasCalendar {
  id: string;
  name: string;
  is_primary: boolean;
}

export interface NylasEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  when: {
    start_time: number;
    end_time: number;
  };
  participants?: NylasEmailRecipient[];
}

// ==========================================
// Contact Types
// ==========================================

export interface NylasContactEmail {
  email: string;
  type?: string;
}

export interface NylasContactPhone {
  number: string;
  type?: string;
}

export interface NylasContact {
  id: string;
  given_name?: string;
  surname?: string;
  emails?: NylasContactEmail[];
  phone_numbers?: NylasContactPhone[];
  company_name?: string;
  notes?: string;
}

// ==========================================
// Availability & Scheduling Types
// ==========================================

export interface FreeBusySlot {
  start_time: number;
  end_time: number;
  status: 'busy' | 'free';
}

export interface FreeBusyData {
  email: string;
  timeSlots: FreeBusySlot[];
}

export interface AvailableSlot {
  start_time: number;
  end_time: number;
  score: number;
  reason: string;
}

// ==========================================
// Batch Operations Types
// ==========================================

export interface BatchEventCreate {
  title: string;
  description?: string;
  startTime: string | number;
  endTime: string | number;
  participants?: string[];
  location?: string;
}

export interface BatchCreateResult {
  success: boolean;
  created: NylasEvent[];
  failed: Array<{ event: BatchEventCreate; error: string }>;
}

// ==========================================
// Conflict Detection Types
// ==========================================

export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: NylasEvent[];
  alternativeSlots?: AvailableSlot[];
}

// ==========================================
// Grant Types (moved from User model)
// ==========================================

export interface INylasGrant {
  grantId: string;
  email: string;
  provider: string;
  status: 'active' | 'expired' | 'revoked';
  scopes?: string[];
  createdAt: Date;
  expiresAt?: Date;
}
