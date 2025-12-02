/**
 * Company Calendar Service - Multi-Grant Admin Pattern
 *
 * Provides company-wide calendar access by aggregating operations across
 * all user grants. This is the foundation layer (Layer 0) for the three-agent
 * architecture (Contacts, Calendar, Email).
 *
 * Key Features:
 * - Parallel queries across all company grants with Promise.all()
 * - Grant resolution (email → Nylas grant ID)
 * - Company-wide availability aggregation
 * - "On behalf of" scheduling
 * - User connection management
 */

import { NylasAccount } from '../models/NylasAccount';
import { User } from '../models/User';
import {
  getCalendarEventsForGrant,
  createCalendarEventForGrant,
  NylasEventMultiUser,
  CreateEventParams,
} from '../integrations/nylas/nylas-multi-user.service';

// ==========================================
// Core Grant Management
// ==========================================

/**
 * Get all active Nylas grants for a company
 *
 * @param companyId - MongoDB company ID
 * @returns Array of active Nylas accounts, sorted by email
 */
export const getAllCompanyGrants = async (
  companyId: string
): Promise<any[]> => {
  return NylasAccount.find({
    companyId,
    status: 'active',
  }).sort({ email: 1 });
};

/**
 * Find user's Nylas grant by email
 *
 * @param companyId - MongoDB company ID
 * @param userEmail - User's email address
 * @returns Nylas account or null if not found
 */
export const findUserGrant = async (
  companyId: string,
  userEmail: string
): Promise<any | null> => {
  return NylasAccount.findOne({
    companyId,
    email: userEmail,
    status: 'active',
  });
};

/**
 * Find user's grant or throw error if not connected
 *
 * @param companyId - MongoDB company ID
 * @param userEmail - User's email address
 * @returns Nylas account
 * @throws Error if user hasn't connected calendar
 */
export const findUserGrantOrThrow = async (
  companyId: string,
  userEmail: string
): Promise<any> => {
  const account = await findUserGrant(companyId, userEmail);
  if (!account) {
    throw new Error(
      `User ${userEmail} has not connected their calendar. ` +
      `Ask them to connect via OAuth in settings.`
    );
  }
  return account;
};

// ==========================================
// Company-Wide Availability
// ==========================================

/**
 * Get calendar events across entire company (parallel queries)
 *
 * @param companyId - MongoDB company ID
 * @param timeRange - Unix timestamp range
 * @returns Map of email → events
 */
export const getCompanyWideAvailability = async (
  companyId: string,
  timeRange: { start: number; end: number }
): Promise<Map<string, NylasEventMultiUser[]>> => {
  const accounts = await getAllCompanyGrants(companyId);

  // Query all grants in parallel with Promise.all
  const results = await Promise.all(
    accounts.map(async (account) => {
      try {
        const events = await getCalendarEventsForGrant(
          account.nylasGrantId,
          {
            start: timeRange.start,
            end: timeRange.end,
          }
        );
        return { email: account.email, events };
      } catch (error: any) {
        console.error(
          `[Company Calendar] Failed to fetch events for ${account.email}:`,
          error.message
        );
        return { email: account.email, events: [] }; // Graceful degradation
      }
    })
  );

  // Return as Map for easy lookup
  return new Map(results.map((r) => [r.email, r.events]));
};

/**
 * Get full company schedule snapshot for specific day
 *
 * @param companyId - MongoDB company ID
 * @param date - Date string in YYYY-MM-DD format
 * @returns Company schedule with utilization metrics
 */
export const getCompanyScheduleSnapshot = async (
  companyId: string,
  date: string
): Promise<{
  date: string;
  employees: Array<{
    email: string;
    name: string;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      status: string;
    }>;
    utilization: number;
  }>;
  companyUtilization: number;
}> => {
  // Parse date and create day boundaries
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all events for the day
  const availabilityMap = await getCompanyWideAvailability(companyId, {
    start: Math.floor(startOfDay.getTime() / 1000),
    end: Math.floor(endOfDay.getTime() / 1000),
  });

  // Calculate utilization for each employee
  const employees = Array.from(availabilityMap.entries()).map(
    ([email, events]) => {
      const totalMinutes = 8 * 60; // 8-hour workday
      const busyMinutes = events.reduce((sum, event) => {
        const duration = (event.when.end_time - event.when.start_time) / 60;
        return sum + duration;
      }, 0);

      return {
        email,
        name: email.split('@')[0], // Simple fallback
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          start: new Date(e.when.start_time * 1000).toISOString(),
          end: new Date(e.when.end_time * 1000).toISOString(),
          status: e.status || 'busy',
        })),
        utilization: Math.round((busyMinutes / totalMinutes) * 100),
      };
    }
  );

  // Calculate average company utilization
  const companyUtilization =
    employees.length > 0
      ? Math.round(
          employees.reduce((sum, e) => sum + e.utilization, 0) /
            employees.length
        )
      : 0;

  return { date, employees, companyUtilization };
};

// ==========================================
// Scheduling Operations
// ==========================================

/**
 * Create calendar event using specific user's grant (acts "on behalf of")
 *
 * @param companyId - MongoDB company ID
 * @param organizerEmail - Organizer's email address
 * @param eventDetails - Event creation parameters
 * @returns Created event
 */
export const scheduleOnBehalfOf = async (
  companyId: string,
  organizerEmail: string,
  eventDetails: CreateEventParams
): Promise<NylasEventMultiUser> => {
  const organizerAccount = await findUserGrantOrThrow(
    companyId,
    organizerEmail
  );

  // Use THEIR grant to create event
  return createCalendarEventForGrant(
    organizerAccount.nylasGrantId,
    eventDetails
  );
};

// ==========================================
// Batch Operations
// ==========================================

/**
 * Generic helper for batch grant operations (Pure Function Pattern)
 *
 * @param grantIds - Array of Nylas grant IDs
 * @param queryFn - Function to execute for each grant
 * @returns Array of results with error tracking
 */
export const batchQueryGrants = async <T>(
  grantIds: string[],
  queryFn: (grantId: string) => Promise<T>
): Promise<Array<{ grantId: string; result: T | null; error?: string }>> => {
  const results = await Promise.allSettled(
    grantIds.map(async (grantId) => {
      const result = await queryFn(grantId);
      return { grantId, result };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        grantId: grantIds[index],
        result: null,
        error: result.reason?.message || 'Unknown error',
      };
    }
  });
};

// ==========================================
// User Connection Management
// ==========================================

/**
 * Check if user has connected their calendar
 *
 * @param companyId - MongoDB company ID
 * @param email - User's email address
 * @returns true if user has active Nylas grant
 */
export const isUserConnected = async (
  companyId: string,
  email: string
): Promise<boolean> => {
  const account = await findUserGrant(companyId, email);
  return account !== null;
};

/**
 * Get list of employees who haven't connected calendars
 *
 * @param companyId - MongoDB company ID
 * @param allEmployeeEmails - List of all employee emails
 * @returns Array of disconnected employee emails
 */
export const getDisconnectedUsers = async (
  companyId: string,
  allEmployeeEmails: string[]
): Promise<string[]> => {
  const connectedGrants = await getAllCompanyGrants(companyId);
  const connectedEmails = new Set(connectedGrants.map((g) => g.email));

  return allEmployeeEmails.filter((email) => !connectedEmails.has(email));
};

/**
 * Get company calendar connection statistics
 *
 * @param companyId - MongoDB company ID
 * @returns Connection stats with rates
 */
export const getConnectionStats = async (
  companyId: string
): Promise<{
  total_employees: number;
  connected: number;
  disconnected: number;
  connection_rate: number;
}> => {
  const allUsers = await User.countDocuments({ companyId });
  const connectedGrants = await NylasAccount.countDocuments({
    companyId,
    status: 'active',
  });

  return {
    total_employees: allUsers,
    connected: connectedGrants,
    disconnected: allUsers - connectedGrants,
    connection_rate:
      allUsers > 0 ? Math.round((connectedGrants / allUsers) * 100) : 0,
  };
};

// ==========================================
// Helper Functions (Pure)
// ==========================================

/**
 * Convert email list to grant IDs
 *
 * @param companyId - MongoDB company ID
 * @param emails - Array of email addresses
 * @returns Array of grant IDs (only for connected users)
 */
export const emailsToGrantIds = async (
  companyId: string,
  emails: string[]
): Promise<Array<{ email: string; grantId: string | null }>> => {
  return Promise.all(
    emails.map(async (email) => {
      const account = await findUserGrant(companyId, email);
      return {
        email,
        grantId: account?.nylasGrantId || null,
      };
    })
  );
};

/**
 * Filter to only connected users
 *
 * @param companyId - MongoDB company ID
 * @param emails - Array of email addresses
 * @returns Object with connected and disconnected arrays
 */
export const partitionByConnection = async (
  companyId: string,
  emails: string[]
): Promise<{
  connected: string[];
  disconnected: string[];
}> => {
  const mappings = await emailsToGrantIds(companyId, emails);

  return {
    connected: mappings.filter((m) => m.grantId !== null).map((m) => m.email),
    disconnected: mappings
      .filter((m) => m.grantId === null)
      .map((m) => m.email),
  };
};
