/**
 * Workspace API Routes
 * AutoDiagram Video Generator - Iteration 67 Phase B1
 *
 * Endpoints:
 * - POST   /api/v1/workspaces           - Create workspace
 * - GET    /api/v1/workspaces           - List user workspaces
 * - GET    /api/v1/workspaces/:id       - Get workspace details
 * - PATCH  /api/v1/workspaces/:id       - Update workspace
 * - DELETE /api/v1/workspaces/:id       - Delete workspace
 * - POST   /api/v1/workspaces/:id/members/invite - Invite member
 * - POST   /api/v1/workspaces/:id/members/:userId/role - Update member role
 * - DELETE /api/v1/workspaces/:id/members/:userId - Remove member
 * - GET    /api/v1/workspaces/:id/activities - Get workspace activities
 */

import { Router, Request, Response } from 'express';
import { workspaceManager } from '../services/workspace-manager';
import { authenticate } from '../middleware/auth';

const router = Router();

// All workspace routes require authentication
router.use(authenticate);

// ============================================================================
// Workspace CRUD Operations
// ============================================================================

/**
 * Create new workspace
 * POST /api/v1/workspaces
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('[WorkspaceRoutes] Creating workspace:', req.body);

    const userId = (req as any).user.userId;
    const workspace = await workspaceManager.createWorkspace(userId, req.body);

    res.status(201).json({
      success: true,
      data: workspace,
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Create workspace error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'WORKSPACE_CREATE_FAILED',
        message: error.message,
        statusCode: 400,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * List user's workspaces
 * GET /api/v1/workspaces
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const workspaces = await workspaceManager.listWorkspaces(userId);

    res.json({
      success: true,
      data: {
        workspaces,
        totalCount: workspaces.length,
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] List workspaces error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKSPACE_LIST_FAILED',
        message: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Get workspace details
 * GET /api/v1/workspaces/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const workspace = await workspaceManager.getWorkspace(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if user is a member
    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'You do not have access to this workspace',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: workspace,
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Get workspace error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKSPACE_GET_FAILED',
        message: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Update workspace
 * PATCH /api/v1/workspaces/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const workspace = await workspaceManager.updateWorkspace(
      id,
      userId,
      req.body
    );

    res.json({
      success: true,
      data: workspace,
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Update workspace error:', error);

    const statusCode = error.message.includes('permission') ? 403 : 400;

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'WORKSPACE_UPDATE_FAILED',
        message: error.message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Delete workspace
 * DELETE /api/v1/workspaces/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    await workspaceManager.deleteWorkspace(id, userId);

    res.json({
      success: true,
      data: {
        message: 'Workspace deleted successfully',
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Delete workspace error:', error);

    const statusCode = error.message.includes('owner') ? 403 : 404;

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'WORKSPACE_DELETE_FAILED',
        message: error.message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ============================================================================
// Member Management
// ============================================================================

/**
 * Invite member to workspace
 * POST /api/v1/workspaces/:id/members/invite
 */
router.post('/:id/members/invite', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const invitation = await workspaceManager.inviteMember(
      id,
      userId,
      req.body
    );

    res.status(201).json({
      success: true,
      data: invitation,
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Invite member error:', error);

    const statusCode = error.message.includes('permission')
      ? 403
      : error.message.includes('limit')
        ? 400
        : 500;

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'MEMBER_INVITE_FAILED',
        message: error.message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Update member role
 * PATCH /api/v1/workspaces/:id/members/:userId/role
 */
router.patch(
  '/:id/members/:userId/role',
  async (req: Request, res: Response) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const adminId = (req as any).user.userId;

      const member = await workspaceManager.updateMemberRole(id, adminId, {
        userId: targetUserId,
        ...req.body,
      });

      res.json({
        success: true,
        data: member,
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      });
    } catch (error: any) {
      console.error('[WorkspaceRoutes] Update member role error:', error);

      const statusCode = error.message.includes('permission') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'MEMBER_ROLE_UPDATE_FAILED',
          message: error.message,
          statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Remove member from workspace
 * DELETE /api/v1/workspaces/:id/members/:userId
 */
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const adminId = (req as any).user.userId;

    await workspaceManager.removeMember(id, adminId, targetUserId);

    res.json({
      success: true,
      data: {
        message: 'Member removed successfully',
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Remove member error:', error);

    const statusCode = error.message.includes('permission') ? 403 : 404;

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'MEMBER_REMOVE_FAILED',
        message: error.message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ============================================================================
// Activity & Audit Log
// ============================================================================

/**
 * Get workspace activities
 * GET /api/v1/workspaces/:id/activities
 */
router.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check access
    const workspace = await workspaceManager.getWorkspace(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'You do not have access to this workspace',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const activities = await workspaceManager.getActivities(id, limit);

    res.json({
      success: true,
      data: {
        activities,
        totalCount: activities.length,
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Get activities error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVITIES_GET_FAILED',
        message: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ============================================================================
// Invitation Management
// ============================================================================

/**
 * Accept workspace invitation
 * POST /api/v1/invitations/:id/accept
 */
router.post('/invitations/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const member = await workspaceManager.acceptInvitation(id, userId);

    res.json({
      success: true,
      data: member,
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
  } catch (error: any) {
    console.error('[WorkspaceRoutes] Accept invitation error:', error);

    const statusCode = error.message.includes('expired')
      ? 410
      : error.message.includes('not found')
        ? 404
        : 400;

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'INVITATION_ACCEPT_FAILED',
        message: error.message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
