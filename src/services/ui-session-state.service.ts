/**
 * UI Session State Service
 *
 * Tracks real-time UI state for each user/session to enable programmatic
 * UI querying and control from Claude Code and other external tools.
 *
 * This service maintains an in-memory cache of UI state that is updated
 * via WebSocket events from the frontend.
 */

export interface WorkspaceDocument {
  path: string;
  content: string;
  lastModified: Date;
  metadata?: Record<string, any>;
}

export interface UIContext {
  selectedTeam?: string;
  filters?: Record<string, any>;
  activeTab?: string;
  modalState?: string;
  breadcrumbs?: string[];
}

export interface UISessionState {
  userId: string;
  sessionId: string;
  currentRoute: string;
  openWorkspaceDocument?: WorkspaceDocument;
  uiContext: UIContext;
  lastUpdate: Date;
  connectionId?: string; // WebSocket connection ID
  assistantId?: string; // Active assistant ID
}

type StateChangeCallback = (state: UISessionState) => void;

class UISessionStateService {
  // In-memory storage: userId -> UISessionState
  private stateByUser: Map<string, UISessionState> = new Map();

  // In-memory storage: sessionId -> UISessionState
  private stateBySession: Map<string, UISessionState> = new Map();

  // State change listeners: userId -> callbacks
  private listeners: Map<string, Set<StateChangeCallback>> = new Map();

  /**
   * Update UI state for a user/session
   */
  updateUIState(userId: string, state: Partial<UISessionState>): void {
    const existingState = this.stateByUser.get(userId);

    const newState: UISessionState = {
      userId,
      sessionId: state.sessionId || existingState?.sessionId || '',
      currentRoute: state.currentRoute || existingState?.currentRoute || '/',
      openWorkspaceDocument:
        state.openWorkspaceDocument || existingState?.openWorkspaceDocument,
      uiContext: {
        ...existingState?.uiContext,
        ...state.uiContext,
      },
      lastUpdate: new Date(),
      connectionId: state.connectionId || existingState?.connectionId,
      assistantId: state.assistantId || existingState?.assistantId,
    };

    // Update both maps
    this.stateByUser.set(userId, newState);
    if (newState.sessionId) {
      this.stateBySession.set(newState.sessionId, newState);
    }

    // Notify listeners
    this.notifyListeners(userId, newState);
  }

  /**
   * Get current UI state for a user
   */
  getUIState(userId: string): UISessionState | null {
    return this.stateByUser.get(userId) || null;
  }

  /**
   * Get UI state by session ID
   */
  getUIStateBySession(sessionId: string): UISessionState | null {
    return this.stateBySession.get(sessionId) || null;
  }

  /**
   * Update current route for a session
   */
  updateRoute(sessionId: string, route: string): void {
    const state = this.stateBySession.get(sessionId);
    if (state) {
      this.updateUIState(state.userId, {
        sessionId,
        currentRoute: route,
      });
    }
  }

  /**
   * Update open workspace document
   */
  updateWorkspaceDocument(
    sessionId: string,
    document: WorkspaceDocument | undefined,
  ): void {
    const state = this.stateBySession.get(sessionId);
    if (state) {
      this.updateUIState(state.userId, {
        sessionId,
        openWorkspaceDocument: document,
      });
    }
  }

  /**
   * Update UI context (filters, tabs, etc.)
   */
  updateContext(sessionId: string, context: Partial<UIContext>): void {
    const state = this.stateBySession.get(sessionId);
    if (state) {
      this.updateUIState(state.userId, {
        sessionId,
        uiContext: context,
      });
    }
  }

  /**
   * Update active assistant
   */
  updateActiveAssistant(sessionId: string, assistantId: string): void {
    const state = this.stateBySession.get(sessionId);
    if (state) {
      this.updateUIState(state.userId, {
        sessionId,
        assistantId,
      });
    }
  }

  /**
   * Clear UI state for a user (on disconnect)
   */
  clearUIState(userId: string): void {
    const state = this.stateByUser.get(userId);
    if (state?.sessionId) {
      this.stateBySession.delete(state.sessionId);
    }
    this.stateByUser.delete(userId);
    this.listeners.delete(userId);
  }

  /**
   * Clear UI state by session ID
   */
  clearUIStateBySession(sessionId: string): void {
    const state = this.stateBySession.get(sessionId);
    if (state) {
      this.clearUIState(state.userId);
    }
  }

  /**
   * Listen for state changes for a specific user
   */
  onStateChange(userId: string, callback: StateChangeCallback): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(userId: string, state: UISessionState): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach((callback) => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in UI state listener:', error);
        }
      });
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.stateBySession.keys());
  }

  /**
   * Get all active users
   */
  getActiveUsers(): string[] {
    return Array.from(this.stateByUser.keys());
  }

  /**
   * Get statistics about tracked UI state
   */
  getStats(): {
    activeUsers: number;
    activeSessions: number;
    listeners: number;
  } {
    return {
      activeUsers: this.stateByUser.size,
      activeSessions: this.stateBySession.size,
      listeners: Array.from(this.listeners.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
    };
  }

  /**
   * Clear all state (for testing)
   */
  clearAll(): void {
    this.stateByUser.clear();
    this.stateBySession.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const uiSessionStateService = new UISessionStateService();
