/**
 * Workspace Manager Service
 * AutoDiagram Video Generator - Iteration 67 Phase B1
 *
 * Implements core workspace management functionality:
 * - Workspace CRUD operations
 * - Member management
 * - Permission validation
 * - Quota tracking
 */

import { EventEmitter } from 'events';
import {
  Workspace,
  WorkspaceSettings,
  WorkspaceMember,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  WorkspaceInvitation,
  WorkspaceActivity,
  PERMISSIONS,
  SYSTEM_ROLES,
} from '../types/workspace';
import { v4 as uuidv4 } from 'uuid';

export class WorkspaceManager extends EventEmitter {
  private workspaces: Map<string, Workspace> = new Map();
  private invitations: Map<string, WorkspaceInvitation> = new Map();
  private activities: Map<string, WorkspaceActivity[]> = new Map();

  constructor() {
    super();
    console.log('[WorkspaceManager] Initialized');
  }

  // ========================================================================
  // Workspace CRUD Operations
  // ========================================================================

  async createWorkspace(
    userId: string,
    request: CreateWorkspaceRequest
  ): Promise<Workspace> {
    console.log(`[WorkspaceManager] Creating workspace: ${request.name}`);

    const workspaceId = uuidv4();
    const slug = request.slug || this.generateSlug(request.name);

    // Validate slug uniqueness
    if (this.isSlugTaken(slug)) {
      throw new Error(`Workspace slug "${slug}" is already taken`);
    }

    const workspace: Workspace = {
      id: workspaceId,
      name: request.name,
      slug,
      description: request.description,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: this.getDefaultSettings(request.settings),
      quota: this.getDefaultQuota(),
      members: [
        {
          userId,
          workspaceId,
          role: 'owner',
          permissions: Object.values(PERMISSIONS),
          joinedAt: new Date(),
          status: 'active',
        },
      ],
    };

    this.workspaces.set(workspaceId, workspace);

    // Log activity
    await this.logActivity(workspaceId, userId, 'workspace.created', {
      workspaceName: request.name,
    });

    this.emit('workspace:created', workspace);

    console.log(`✅ Workspace created: ${workspaceId}`);
    return workspace;
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaces.get(workspaceId) || null;
  }

  async getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return workspace;
      }
    }
    return null;
  }

  async listWorkspaces(userId: string): Promise<Workspace[]> {
    const userWorkspaces: Workspace[] = [];

    for (const workspace of this.workspaces.values()) {
      const member = workspace.members.find((m) => m.userId === userId);
      if (member && member.status === 'active') {
        userWorkspaces.push(workspace);
      }
    }

    return userWorkspaces;
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    request: UpdateWorkspaceRequest
  ): Promise<Workspace> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Permission check
    if (!this.hasPermission(workspace, userId, PERMISSIONS.WORKSPACE_EDIT)) {
      throw new Error('Insufficient permissions to update workspace');
    }

    // Update fields
    if (request.name) workspace.name = request.name;
    if (request.description !== undefined)
      workspace.description = request.description;
    if (request.settings) {
      workspace.settings = { ...workspace.settings, ...request.settings };
    }
    workspace.updatedAt = new Date();

    this.workspaces.set(workspaceId, workspace);

    await this.logActivity(workspaceId, userId, 'workspace.updated', {
      changes: request,
    });

    this.emit('workspace:updated', workspace);

    return workspace;
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Only owner can delete
    if (workspace.ownerId !== userId) {
      throw new Error('Only workspace owner can delete the workspace');
    }

    this.workspaces.delete(workspaceId);

    await this.logActivity(workspaceId, userId, 'workspace.deleted', {});

    this.emit('workspace:deleted', { workspaceId });

    console.log(`✅ Workspace deleted: ${workspaceId}`);
  }

  // ========================================================================
  // Member Management
  // ========================================================================

  async inviteMember(
    workspaceId: string,
    inviterId: string,
    request: InviteMemberRequest
  ): Promise<WorkspaceInvitation> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Permission check
    if (!this.hasPermission(workspace, inviterId, PERMISSIONS.MEMBERS_INVITE)) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Check member limit
    if (workspace.members.length >= workspace.settings.maxMembers) {
      throw new Error('Workspace member limit reached');
    }

    const invitation: WorkspaceInvitation = {
      id: uuidv4(),
      workspaceId,
      email: request.email,
      role: request.role,
      permissions: request.permissions || SYSTEM_ROLES[request.role].permissions,
      invitedBy: inviterId,
      message: request.message,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.invitations.set(invitation.id, invitation);

    await this.logActivity(workspaceId, inviterId, 'member.invited', {
      email: request.email,
      role: request.role,
    });

    this.emit('member:invited', invitation);

    console.log(`✅ Member invited: ${request.email} to ${workspaceId}`);
    return invitation;
  }

  async acceptInvitation(
    invitationId: string,
    userId: string
  ): Promise<WorkspaceMember> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      throw new Error('Invitation has expired');
    }

    const workspace = await this.getWorkspace(invitation.workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Add member to workspace
    const member: WorkspaceMember = {
      userId,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
      permissions: invitation.permissions,
      joinedAt: new Date(),
      invitedBy: invitation.invitedBy,
      status: 'active',
    };

    workspace.members.push(member);
    this.workspaces.set(workspace.id, workspace);

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    this.invitations.set(invitationId, invitation);

    await this.logActivity(workspace.id, userId, 'member.joined', {
      invitationId,
    });

    this.emit('member:joined', member);

    console.log(`✅ Member joined: ${userId} to ${workspace.id}`);
    return member;
  }

  async updateMemberRole(
    workspaceId: string,
    adminId: string,
    request: UpdateMemberRoleRequest
  ): Promise<WorkspaceMember> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Permission check
    if (!this.hasPermission(workspace, adminId, PERMISSIONS.MEMBERS_MANAGE)) {
      throw new Error('Insufficient permissions to manage members');
    }

    const member = workspace.members.find((m) => m.userId === request.userId);
    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot change owner role
    if (member.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    const oldRole = member.role;
    member.role = request.role;
    member.permissions =
      request.permissions || SYSTEM_ROLES[request.role].permissions;

    this.workspaces.set(workspaceId, workspace);

    await this.logActivity(workspaceId, adminId, 'member.role_changed', {
      userId: request.userId,
      oldRole,
      newRole: request.role,
    });

    this.emit('member:role_changed', member);

    console.log(`✅ Member role updated: ${request.userId} -> ${request.role}`);
    return member;
  }

  async removeMember(
    workspaceId: string,
    adminId: string,
    userId: string
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Permission check
    if (!this.hasPermission(workspace, adminId, PERMISSIONS.MEMBERS_REMOVE)) {
      throw new Error('Insufficient permissions to remove members');
    }

    const memberIndex = workspace.members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) {
      throw new Error('Member not found');
    }

    // Cannot remove owner
    if (workspace.members[memberIndex].role === 'owner') {
      throw new Error('Cannot remove workspace owner');
    }

    workspace.members.splice(memberIndex, 1);
    this.workspaces.set(workspaceId, workspace);

    await this.logActivity(workspaceId, adminId, 'member.removed', { userId });

    this.emit('member:removed', { workspaceId, userId });

    console.log(`✅ Member removed: ${userId} from ${workspaceId}`);
  }

  // ========================================================================
  // Permission System
  // ========================================================================

  hasPermission(
    workspace: Workspace,
    userId: string,
    permission: string
  ): boolean {
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member || member.status !== 'active') {
      return false;
    }

    return member.permissions.includes(permission);
  }

  hasAnyPermission(
    workspace: Workspace,
    userId: string,
    permissions: string[]
  ): boolean {
    return permissions.some((p) => this.hasPermission(workspace, userId, p));
  }

  hasAllPermissions(
    workspace: Workspace,
    userId: string,
    permissions: string[]
  ): boolean {
    return permissions.every((p) => this.hasPermission(workspace, userId, p));
  }

  // ========================================================================
  // Quota Management
  // ========================================================================

  async checkQuota(
    workspaceId: string,
    type: 'processing' | 'storage' | 'jobs'
  ): Promise<boolean> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const quota = workspace.quota;

    switch (type) {
      case 'processing':
        return quota.monthlyProcessingUsed < quota.monthlyProcessingLimit;
      case 'storage':
        return quota.storageUsed < quota.storageLimit;
      case 'jobs':
        // This would be checked against concurrent jobs in real implementation
        return true;
      default:
        return false;
    }
  }

  async updateQuotaUsage(
    workspaceId: string,
    type: 'processing' | 'storage',
    amount: number
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    switch (type) {
      case 'processing':
        workspace.quota.monthlyProcessingUsed += amount;
        break;
      case 'storage':
        workspace.quota.storageUsed += amount;
        break;
    }

    this.workspaces.set(workspaceId, workspace);

    // Check if quota exceeded
    if (!(await this.checkQuota(workspaceId, type))) {
      await this.logActivity(workspaceId, workspace.ownerId, 'quota.exceeded', {
        type,
        limit: workspace.quota[`${type}Limit`],
        used: workspace.quota[`${type}Used`],
      });

      this.emit('quota:exceeded', { workspaceId, type });
    }
  }

  // ========================================================================
  // Activity Logging
  // ========================================================================

  private async logActivity(
    workspaceId: string,
    userId: string,
    action: any,
    details: Record<string, any>
  ): Promise<void> {
    const activity: WorkspaceActivity = {
      id: uuidv4(),
      workspaceId,
      userId,
      action,
      resourceType: this.getResourceTypeFromAction(action),
      resourceId: workspaceId,
      details,
      timestamp: new Date(),
    };

    const activities = this.activities.get(workspaceId) || [];
    activities.push(activity);
    this.activities.set(workspaceId, activities);

    this.emit('activity:logged', activity);
  }

  async getActivities(
    workspaceId: string,
    limit: number = 50
  ): Promise<WorkspaceActivity[]> {
    const activities = this.activities.get(workspaceId) || [];
    return activities.slice(-limit).reverse();
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private isSlugTaken(slug: string): boolean {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return true;
      }
    }
    return false;
  }

  private getDefaultSettings(
    override?: Partial<WorkspaceSettings>
  ): WorkspaceSettings {
    return {
      allowMemberInvites: true,
      defaultMemberRole: 'editor',
      requireApprovalForInvites: false,
      maxMembers: 10,
      features: {
        realTimeCollaboration: true,
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: true,
      },
      ...override,
    };
  }

  private getDefaultQuota() {
    return {
      monthlyProcessingLimit: 1000,
      monthlyProcessingUsed: 0,
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
      storageUsed: 0,
      concurrentJobsLimit: 3,
      membersLimit: 10,
      resetDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        1
      ),
    };
  }

  private getResourceTypeFromAction(action: string): any {
    if (action.startsWith('workspace.')) return 'workspace';
    if (action.startsWith('member.')) return 'member';
    if (action.startsWith('job.')) return 'job';
    if (action.startsWith('settings.')) return 'settings';
    if (action.startsWith('quota.')) return 'quota';
    return 'workspace';
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  getStatistics() {
    return {
      totalWorkspaces: this.workspaces.size,
      totalInvitations: this.invitations.size,
      pendingInvitations: Array.from(this.invitations.values()).filter(
        (i) => i.status === 'pending'
      ).length,
      totalMembers: Array.from(this.workspaces.values()).reduce(
        (sum, w) => sum + w.members.length,
        0
      ),
    };
  }
}

// Export singleton instance
export const workspaceManager = new WorkspaceManager();
