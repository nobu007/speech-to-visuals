/**
 * 🤝 Real-time Collaboration Engine
 * Iteration 37 - Phase 2: Multi-user Collaboration System
 *
 * Enables real-time collaborative editing of diagrams
 * Following recursive development: implement → test → evaluate → improve
 */

export interface CollaborationSession {
  id: string;
  projectId: string;
  participants: Participant[];
  permissions: SessionPermissions;
  status: 'active' | 'paused' | 'ended';
  created: Date;
  lastActivity: Date;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  status: 'online' | 'away' | 'offline';
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastSeen: Date;
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
  color: string;
}

export interface SelectionRange {
  elementIds: string[];
  type: 'node' | 'edge' | 'group' | 'text';
  timestamp: Date;
}

export interface SessionPermissions {
  allowEdit: boolean;
  allowComment: boolean;
  allowExport: boolean;
  allowInvite: boolean;
  maxParticipants: number;
}

export interface CollaborationOperation {
  id: string;
  type: OperationType;
  payload: any;
  userId: string;
  timestamp: Date;
  acknowledged: boolean;
}

export type OperationType =
  | 'element.create'
  | 'element.update'
  | 'element.delete'
  | 'element.move'
  | 'comment.add'
  | 'comment.update'
  | 'comment.delete'
  | 'cursor.move'
  | 'selection.change'
  | 'style.update';

export interface Comment {
  id: string;
  elementId?: string;
  position: { x: number; y: number };
  author: Participant;
  content: string;
  created: Date;
  updated?: Date;
  resolved: boolean;
  replies: Comment[];
}

export interface ConflictResolution {
  operation1: CollaborationOperation;
  operation2: CollaborationOperation;
  resolution: 'merge' | 'override' | 'split' | 'manual';
  result: CollaborationOperation;
}

export class RealTimeCollaborationEngine {
  private sessions: Map<string, CollaborationSession>;
  private websockets: Map<string, WebSocket>;
  private operationHistory: Map<string, CollaborationOperation[]>;
  private conflictResolver: ConflictResolver;
  private fallbackMode: boolean;

  constructor() {
    this.sessions = new Map();
    this.websockets = new Map();
    this.operationHistory = new Map();
    this.conflictResolver = new ConflictResolver();
    this.fallbackMode = !this.isWebSocketAvailable();

    console.log('🤝 Real-time Collaboration Engine initialized', {
      mode: this.fallbackMode ? 'offline' : 'websocket',
      timestamp: new Date().toISOString()
    });

    // Initialize fallback polling if WebSocket unavailable
    if (this.fallbackMode) {
      this.initializeFallbackPolling();
    }
  }

  /**
   * Create new collaboration session
   * Following recursive development: small, testable implementations
   */
  async createSession(
    projectId: string,
    owner: Participant,
    permissions: SessionPermissions
  ): Promise<CollaborationSession> {
    const sessionId = this.generateSessionId();

    const session: CollaborationSession = {
      id: sessionId,
      projectId,
      participants: [{ ...owner, role: 'owner', status: 'online' }],
      permissions,
      status: 'active',
      created: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    this.operationHistory.set(sessionId, []);

    // Initialize WebSocket connection if available
    if (!this.fallbackMode) {
      await this.initializeWebSocketForSession(sessionId);
    }

    console.log('✨ Collaboration session created', {
      sessionId,
      projectId,
      participants: session.participants.length
    });

    return session;
  }

  /**
   * Join existing collaboration session
   */
  async joinSession(
    sessionId: string,
    participant: Participant
  ): Promise<CollaborationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('⚠️ Session not found:', sessionId);
      return null;
    }

    // Check permissions and participant limits
    if (session.participants.length >= session.permissions.maxParticipants) {
      throw new Error('Session is full');
    }

    // Add participant
    const updatedParticipant = {
      ...participant,
      status: 'online' as const,
      lastSeen: new Date()
    };

    session.participants.push(updatedParticipant);
    session.lastActivity = new Date();

    // Notify other participants
    await this.broadcastOperation(sessionId, {
      id: this.generateOperationId(),
      type: 'participant.join',
      payload: { participant: updatedParticipant },
      userId: participant.id,
      timestamp: new Date(),
      acknowledged: false
    });

    console.log('👋 Participant joined session', {
      sessionId,
      participantId: participant.id,
      totalParticipants: session.participants.length
    });

    return session;
  }

  /**
   * Send collaboration operation
   */
  async sendOperation(
    sessionId: string,
    operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'acknowledged'>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const fullOperation: CollaborationOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      acknowledged: false
    };

    // Add to operation history
    const history = this.operationHistory.get(sessionId) || [];
    history.push(fullOperation);
    this.operationHistory.set(sessionId, history);

    // Check for conflicts
    const conflicts = await this.detectConflicts(sessionId, fullOperation);
    if (conflicts.length > 0) {
      const resolution = await this.resolveConflicts(conflicts);
      if (resolution) {
        fullOperation.payload = resolution.result.payload;
      }
    }

    // Broadcast to all participants
    await this.broadcastOperation(sessionId, fullOperation);

    // Update session activity
    session.lastActivity = new Date();

    return true;
  }

  /**
   * Update participant cursor position
   */
  async updateCursor(
    sessionId: string,
    userId: string,
    position: CursorPosition
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.id === userId);
    if (participant) {
      participant.cursor = position;

      // Broadcast cursor update (throttled)
      await this.throttledBroadcast(sessionId, {
        id: this.generateOperationId(),
        type: 'cursor.move',
        payload: { userId, position },
        userId,
        timestamp: new Date(),
        acknowledged: false
      }, 100); // 100ms throttle
    }
  }

  /**
   * Add comment to diagram
   */
  async addComment(
    sessionId: string,
    comment: Omit<Comment, 'id' | 'created'>
  ): Promise<Comment | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const fullComment: Comment = {
      ...comment,
      id: this.generateCommentId(),
      created: new Date(),
      resolved: false,
      replies: []
    };

    await this.sendOperation(sessionId, {
      type: 'comment.add',
      payload: { comment: fullComment },
      userId: comment.author.id
    });

    return fullComment;
  }

  /**
   * Get session status and participants
   */
  getSessionStatus(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Leave collaboration session
   */
  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove participant
    session.participants = session.participants.filter(p => p.id !== userId);

    // Notify other participants
    await this.broadcastOperation(sessionId, {
      id: this.generateOperationId(),
      type: 'participant.leave',
      payload: { userId },
      userId,
      timestamp: new Date(),
      acknowledged: false
    });

    // Clean up if session is empty
    if (session.participants.length === 0) {
      this.cleanupSession(sessionId);
    }

    console.log('👋 Participant left session', {
      sessionId,
      userId,
      remainingParticipants: session.participants.length
    });
  }

  /**
   * Broadcast operation to all participants
   */
  private async broadcastOperation(
    sessionId: string,
    operation: CollaborationOperation
  ): Promise<void> {
    if (this.fallbackMode) {
      // Store operation for polling-based sync
      this.storeFallbackOperation(sessionId, operation);
      return;
    }

    // WebSocket broadcast
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message = JSON.stringify({
      type: 'operation',
      sessionId,
      operation
    });

    session.participants.forEach(participant => {
      const ws = this.websockets.get(participant.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Throttled broadcast for high-frequency operations (like cursor moves)
   */
  private throttledBroadcastTimers = new Map<string, NodeJS.Timeout>();

  private async throttledBroadcast(
    sessionId: string,
    operation: CollaborationOperation,
    throttleMs: number
  ): Promise<void> {
    const key = `${sessionId}-${operation.type}-${operation.userId}`;

    // Clear existing timer
    const existingTimer = this.throttledBroadcastTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.broadcastOperation(sessionId, operation);
      this.throttledBroadcastTimers.delete(key);
    }, throttleMs);

    this.throttledBroadcastTimers.set(key, timer);
  }

  /**
   * Detect conflicts between operations
   */
  private async detectConflicts(
    sessionId: string,
    newOperation: CollaborationOperation
  ): Promise<CollaborationOperation[]> {
    const history = this.operationHistory.get(sessionId) || [];
    const conflicts: CollaborationOperation[] = [];

    // Look for conflicting operations in recent history (last 1 minute)
    const recentOperations = history.filter(op =>
      Date.now() - op.timestamp.getTime() < 60000 &&
      op.userId !== newOperation.userId
    );

    for (const operation of recentOperations) {
      if (this.operationsConflict(operation, newOperation)) {
        conflicts.push(operation);
      }
    }

    return conflicts;
  }

  /**
   * Check if two operations conflict
   */
  private operationsConflict(
    op1: CollaborationOperation,
    op2: CollaborationOperation
  ): boolean {
    // Same element operations potentially conflict
    if (op1.payload?.elementId && op2.payload?.elementId) {
      return op1.payload.elementId === op2.payload.elementId;
    }

    // Style operations on same elements conflict
    if (op1.type === 'style.update' && op2.type === 'style.update') {
      return op1.payload?.target === op2.payload?.target;
    }

    return false;
  }

  /**
   * Resolve conflicts between operations
   */
  private async resolveConflicts(
    conflicts: CollaborationOperation[]
  ): Promise<ConflictResolution | null> {
    if (conflicts.length === 0) return null;

    // Use conflict resolver to handle conflicts
    return this.conflictResolver.resolve(conflicts[0], conflicts[1]);
  }

  /**
   * WebSocket availability check
   */
  private isWebSocketAvailable(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  /**
   * Initialize WebSocket for session
   */
  private async initializeWebSocketForSession(sessionId: string): Promise<void> {
    // Placeholder for actual WebSocket initialization
    console.log('🔌 WebSocket initialized for session:', sessionId);
  }

  /**
   * Initialize fallback polling mechanism
   */
  private initializeFallbackPolling(): void {
    setInterval(() => {
      this.pollForOperations();
    }, 2000); // Poll every 2 seconds

    console.log('🔄 Fallback polling initialized');
  }

  /**
   * Store operation for fallback sync
   */
  private storeFallbackOperation(
    sessionId: string,
    operation: CollaborationOperation
  ): void {
    // In production, this would store to a shared backend
    console.log('📦 Operation stored for fallback sync', {
      sessionId,
      operationType: operation.type
    });
  }

  /**
   * Poll for operations in fallback mode
   */
  private pollForOperations(): void {
    // In production, this would fetch from shared backend
    this.sessions.forEach((session, sessionId) => {
      // Simulate checking for new operations
      if (Math.random() < 0.1) { // 10% chance of simulated activity
        console.log('🔄 Polling check for session:', sessionId);
      }
    });
  }

  /**
   * Cleanup session resources
   */
  private cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.operationHistory.delete(sessionId);

    // Cleanup WebSocket connections
    this.websockets.forEach((ws, userId) => {
      if (ws.url?.includes(sessionId)) {
        ws.close();
        this.websockets.delete(userId);
      }
    });

    console.log('🧹 Session cleaned up:', sessionId);
  }

  // ID generation helpers
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Conflict Resolution System
 */
export class ConflictResolver {
  /**
   * Resolve conflicts between operations
   */
  async resolve(
    op1: CollaborationOperation,
    op2: CollaborationOperation
  ): Promise<ConflictResolution> {
    // Last-write-wins strategy for simple conflicts
    const laterOperation = op1.timestamp > op2.timestamp ? op1 : op2;

    return {
      operation1: op1,
      operation2: op2,
      resolution: 'override',
      result: laterOperation
    };
  }

  /**
   * Merge non-conflicting properties
   */
  private mergeOperations(
    op1: CollaborationOperation,
    op2: CollaborationOperation
  ): CollaborationOperation {
    // Merge payloads where possible
    const mergedPayload = { ...op1.payload, ...op2.payload };

    return {
      ...op2, // Use later timestamp
      payload: mergedPayload
    };
  }
}

/**
 * Collaboration Quality Metrics
 */
export class CollaborationMetrics {
  static measureSessionHealth(session: CollaborationSession): number {
    let score = 0.5; // Base score

    // Active participants boost score
    const activeParticipants = session.participants.filter(p => p.status === 'online').length;
    score += Math.min(activeParticipants / 5, 0.3); // Up to 0.3 for active participation

    // Recent activity boost
    const timeSinceActivity = Date.now() - session.lastActivity.getTime();
    if (timeSinceActivity < 300000) { // 5 minutes
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  static calculateLatency(operation: CollaborationOperation): number {
    return Date.now() - operation.timestamp.getTime();
  }
}