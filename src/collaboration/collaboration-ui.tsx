/**
 * 🎨 Real-time Collaboration UI Components
 * Iteration 37 - Phase 2: Collaborative Interface
 *
 * React components for real-time collaboration features
 * Following recursive development and custom instructions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Users, MessageCircle, Share, Settings, Eye, Edit, Crown } from 'lucide-react';

import {
  RealTimeCollaborationEngine,
  CollaborationSession,
  Participant,
  Comment,
  CursorPosition
} from './real-time-engine';

interface CollaborationPanelProps {
  sessionId: string;
  currentUserId: string;
  collaborationEngine: RealTimeCollaborationEngine;
  onInviteUser?: () => void;
  onLeaveSession?: () => void;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  sessionId,
  currentUserId,
  collaborationEngine,
  onInviteUser,
  onLeaveSession
}) => {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load session data
  useEffect(() => {
    const loadSession = () => {
      const sessionData = collaborationEngine.getSessionStatus(sessionId);
      setSession(sessionData);
      setIsLoading(false);
    };

    loadSession();
    const interval = setInterval(loadSession, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [sessionId, collaborationEngine]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !session) return;

    const currentUser = session.participants.find(p => p.id === currentUserId);
    if (!currentUser) return;

    const comment = await collaborationEngine.addComment(sessionId, {
      elementId: undefined, // General comment
      position: { x: 100, y: 100 },
      author: currentUser,
      content: newComment.trim(),
      resolved: false,
      replies: []
    });

    if (comment) {
      setComments(prev => [...prev, comment]);
      setNewComment('');
    }
  }, [collaborationEngine, sessionId, currentUserId, newComment, session]);

  if (isLoading) {
    return (
      <Card className=\"w-80\">
        <CardContent className=\"p-6\">
          <div className=\"animate-pulse space-y-4\">
            <div className=\"h-4 bg-gray-200 rounded w-3/4\"></div>
            <div className=\"h-4 bg-gray-200 rounded w-1/2\"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className=\"w-80\">
        <CardContent className=\"p-6\">
          <div className=\"text-center text-muted-foreground\">
            Session not found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className=\"w-80 h-full flex flex-col\">
      <CardHeader className=\"pb-3\">
        <CardTitle className=\"flex items-center gap-2 text-lg\">
          <Users className=\"h-5 w-5\" />
          Collaboration
          <Badge variant=\"secondary\" className=\"ml-auto\">
            {session.participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className=\"flex-1 flex flex-col gap-4 p-4\">
        {/* Participants List */}
        <div className=\"space-y-3\">
          <h3 className=\"font-medium text-sm flex items-center gap-2\">
            <Users className=\"h-4 w-4\" />
            Participants ({session.participants.length})
          </h3>

          <div className=\"space-y-2 max-h-32 overflow-y-auto\">
            {session.participants.map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                isCurrentUser={participant.id === currentUserId}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Comments Section */}
        <div className=\"flex-1 flex flex-col gap-3\">
          <h3 className=\"font-medium text-sm flex items-center gap-2\">
            <MessageCircle className=\"h-4 w-4\" />
            Comments ({comments.length})
          </h3>

          {/* Comments List */}
          <div className=\"flex-1 space-y-2 max-h-40 overflow-y-auto\">
            {comments.length === 0 ? (
              <div className=\"text-center text-muted-foreground text-sm py-4\">
                No comments yet
              </div>
            ) : (
              comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))
            )}
          </div>

          {/* Add Comment */}
          <div className=\"space-y-2\">
            <Textarea
              placeholder=\"Add a comment...\"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className=\"min-h-[60px] text-sm\"
            />
            <Button
              onClick={handleAddComment}
              size=\"sm\"
              className=\"w-full\"
              disabled={!newComment.trim()}
            >
              Add Comment
            </Button>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className=\"space-y-2\">
          {onInviteUser && (
            <Button
              onClick={onInviteUser}
              variant=\"outline\"
              size=\"sm\"
              className=\"w-full\"
            >
              <Share className=\"h-4 w-4 mr-2\" />
              Invite Users
            </Button>
          )}

          {onLeaveSession && (
            <Button
              onClick={onLeaveSession}
              variant=\"outline\"
              size=\"sm\"
              className=\"w-full\"
            >
              Leave Session
            </Button>
          )}
        </div>

        {/* Session Info */}
        <div className=\"text-xs text-muted-foreground space-y-1\">
          <div>Session: {session.id.substring(0, 8)}...</div>
          <div>Status: {session.status}</div>
          <div>
            Last activity: {session.lastActivity.toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface ParticipantItemProps {
  participant: Participant;
  isCurrentUser: boolean;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({
  participant,
  isCurrentUser
}) => {
  const getStatusColor = (status: Participant['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getRoleIcon = (role: Participant['role']) => {
    switch (role) {
      case 'owner': return <Crown className=\"h-3 w-3\" />;
      case 'editor': return <Edit className=\"h-3 w-3\" />;
      case 'viewer': return <Eye className=\"h-3 w-3\" />;
      default: return null;
    }
  };

  return (
    <div className=\"flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50\">
      <div className=\"relative\">
        <Avatar className=\"h-6 w-6\">
          <AvatarImage src={participant.avatar} />
          <AvatarFallback className=\"text-xs\">
            {participant.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background ${getStatusColor(participant.status)}`}
        />
      </div>

      <div className=\"flex-1 min-w-0\">
        <div className=\"flex items-center gap-1\">
          <span className=\"text-sm font-medium truncate\">
            {participant.name}
            {isCurrentUser && ' (You)'}
          </span>
          {getRoleIcon(participant.role)}
        </div>
        <div className=\"text-xs text-muted-foreground capitalize\">
          {participant.role}
        </div>
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment }) => {
  return (
    <div className=\"p-2 rounded-lg bg-muted/30 space-y-1\">
      <div className=\"flex items-center gap-2\">
        <Avatar className=\"h-5 w-5\">
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback className=\"text-xs\">
            {comment.author.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className=\"text-xs font-medium\">{comment.author.name}</span>
        <span className=\"text-xs text-muted-foreground ml-auto\">
          {comment.created.toLocaleTimeString()}
        </span>
      </div>
      <p className=\"text-xs text-foreground pl-7\">{comment.content}</p>
      {comment.resolved && (
        <Badge variant=\"secondary\" className=\"text-xs h-5\">
          Resolved
        </Badge>
      )}
    </div>
  );
};

/**
 * Cursor Display Component
 * Shows other users' cursors on the canvas
 */
interface CollaborativeCursorsProps {
  participants: Participant[];
  currentUserId: string;
}

export const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({
  participants,
  currentUserId
}) => {
  const otherParticipants = participants.filter(
    p => p.id !== currentUserId && p.status === 'online' && p.cursor
  );

  return (
    <div className=\"absolute inset-0 pointer-events-none z-50\">
      {otherParticipants.map((participant) => (
        participant.cursor && (
          <div
            key={participant.id}
            className=\"absolute transition-all duration-100 ease-out\"
            style={{
              left: participant.cursor.x,
              top: participant.cursor.y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            {/* Cursor pointer */}
            <div
              className=\"w-4 h-4 relative\"
              style={{ color: participant.cursor.color }}
            >
              <svg
                viewBox=\"0 0 24 24\"
                fill=\"currentColor\"
                className=\"w-full h-full drop-shadow-md\"
              >
                <path d=\"M12 2L20.09 18.26L12 15L3.91 18.26L12 2Z\" />
              </svg>
            </div>

            {/* User name label */}
            <div
              className=\"absolute top-4 left-2 px-2 py-1 rounded text-xs text-white text-nowrap shadow-lg\"
              style={{ backgroundColor: participant.cursor.color }}
            >
              {participant.name}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

/**
 * Collaboration Status Bar
 * Shows connection status and session info
 */
interface CollaborationStatusProps {
  session: CollaborationSession | null;
  isConnected: boolean;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  session,
  isConnected
}) => {
  if (!session) return null;

  const activeParticipants = session.participants.filter(p => p.status === 'online').length;

  return (
    <div className=\"flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-xs\">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className=\"font-medium\">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      <Separator orientation=\"vertical\" className=\"h-3\" />
      <Users className=\"h-3 w-3\" />
      <span>{activeParticipants} online</span>
    </div>
  );
};

/**
 * Invitation Dialog Component
 */
interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: Participant['role']) => void;
}

export const InviteDialog: React.FC<InviteDialogProps> = ({
  isOpen,
  onClose,
  onInvite
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Participant['role']>('editor');

  const handleInvite = () => {
    if (email.trim()) {
      onInvite(email.trim(), role);
      setEmail('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className=\"fixed inset-0 bg-black/50 flex items-center justify-center z-50\">
      <Card className=\"w-96\">
        <CardHeader>
          <CardTitle>Invite Collaborator</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"space-y-2\">
            <label className=\"text-sm font-medium\">Email address</label>
            <Input
              type=\"email\"
              placeholder=\"colleague@example.com\"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className=\"space-y-2\">
            <label className=\"text-sm font-medium\">Role</label>
            <select
              className=\"w-full p-2 border rounded-md\"
              value={role}
              onChange={(e) => setRole(e.target.value as Participant['role'])}
            >
              <option value=\"editor\">Editor - Can edit diagrams</option>
              <option value=\"viewer\">Viewer - Can only view</option>
              <option value=\"commenter\">Commenter - Can add comments</option>
            </select>
          </div>

          <div className=\"flex gap-2 pt-2\">
            <Button onClick={handleInvite} className=\"flex-1\">
              Send Invitation
            </Button>
            <Button onClick={onClose} variant=\"outline\">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Hook for managing collaboration state
 */
export const useCollaboration = (
  sessionId: string,
  currentUserId: string,
  collaborationEngine: RealTimeCollaborationEngine
) => {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const updateSession = () => {
      const sessionData = collaborationEngine.getSessionStatus(sessionId);
      setSession(sessionData);
      setIsConnected(!!sessionData);
    };

    updateSession();
    const interval = setInterval(updateSession, 1000);

    return () => clearInterval(interval);
  }, [sessionId, collaborationEngine]);

  const updateCursor = useCallback((position: CursorPosition) => {
    collaborationEngine.updateCursor(sessionId, currentUserId, position);
  }, [collaborationEngine, sessionId, currentUserId]);

  const leaveSession = useCallback(() => {
    collaborationEngine.leaveSession(sessionId, currentUserId);
  }, [collaborationEngine, sessionId, currentUserId]);

  return {
    session,
    isConnected,
    updateCursor,
    leaveSession
  };
};