import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/linear-api.js', () => ({
  graphql: vi.fn(),
  resolveIssueId: vi.fn(),
  resolveTeamId: vi.fn(),
  resolveStateId: vi.fn(),
  resolveUserId: vi.fn(),
  resolveLabelIds: vi.fn(),
  resolveProjectId: vi.fn(),
  resolveMilestoneId: vi.fn(),
}))

const {
  graphql,
  resolveIssueId,
  resolveTeamId,
  resolveStateId,
  resolveUserId,
  resolveLabelIds,
  resolveProjectId,
  resolveMilestoneId,
} = await import('../../src/linear-api.js')
const { createIssueTool } = await import('../../src/tools/linear-issue-tool.js')

const mockedGraphql = vi.mocked(graphql)
const mockedResolveIssueId = vi.mocked(resolveIssueId)
const mockedResolveTeamId = vi.mocked(resolveTeamId)
const mockedResolveStateId = vi.mocked(resolveStateId)
const mockedResolveUserId = vi.mocked(resolveUserId)
const mockedResolveLabelIds = vi.mocked(resolveLabelIds)
const mockedResolveProjectId = vi.mocked(resolveProjectId)
const mockedResolveMilestoneId = vi.mocked(resolveMilestoneId)

function parse(result: { content: { type: string; text?: string }[] }) {
  const text = result.content.find((c) => c.type === 'text')?.text
  return text ? JSON.parse(text) : undefined
}

function getMutationInput(callIndex = 0): Record<string, unknown> {
  return (mockedGraphql.mock.calls[callIndex][1] as { input: Record<string, unknown> }).input
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linear_issue tool', () => {
  describe('view', () => {
    it('resolves identifier and fetches full issue details', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-42')
      mockedGraphql.mockResolvedValue({
        issue: {
          id: 'uuid-42',
          identifier: 'ENG-42',
          title: 'Fix bug',
          state: { name: 'Todo' },
        },
      })

      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'view',
          issueId: 'ENG-42',
        }),
      )

      expect(mockedResolveIssueId).toHaveBeenCalledWith('ENG-42')
      expect(data.identifier).toBe('ENG-42')
      expect(data.title).toBe('Fix bug')
    })

    it('returns error without issueId', async () => {
      const data = parse(await createIssueTool().execute('call-1', { action: 'view' }))
      expect(data.error).toContain('issueId is required')
    })
  })

  describe('list', () => {
    it('applies no filter and defaults limit to 50 when called with no params', async () => {
      mockedGraphql.mockResolvedValue({ issues: { nodes: [] } })

      await createIssueTool().execute('call-1', { action: 'list' })

      const vars = mockedGraphql.mock.calls[0][1] as Record<string, unknown>
      expect(vars.first).toBe(50)
      expect(vars.state).toBeUndefined()
      expect(vars.assignee).toBeUndefined()
      expect(vars.team).toBeUndefined()
      expect(vars.project).toBeUndefined()
    })

    it('passes state, team, assignee, and project as query variables', async () => {
      mockedGraphql.mockResolvedValue({ issues: { nodes: [] } })

      await createIssueTool().execute('call-1', {
        action: 'list',
        state: 'In Progress',
        team: 'eng',
        assignee: 'alice@example.com',
        project: 'Alpha',
        limit: 10,
      })

      const vars = mockedGraphql.mock.calls[0][1] as Record<string, unknown>
      expect(vars.state).toBe('In Progress')
      expect(vars.team).toBe('ENG') // uppercased
      expect(vars.assignee).toBe('alice@example.com')
      expect(vars.project).toBe('Alpha')
      expect(vars.first).toBe(10)
    })

    it('returns the issues from the API', async () => {
      mockedGraphql.mockResolvedValue({
        issues: {
          nodes: [
            { id: 'i1', identifier: 'ENG-1', title: 'Task 1' },
            { id: 'i2', identifier: 'ENG-2', title: 'Task 2' },
          ],
        },
      })

      const data = parse(await createIssueTool().execute('call-1', { action: 'list' }))
      expect(data.issues).toHaveLength(2)
      expect(data.issues[0].identifier).toBe('ENG-1')
    })
  })

  describe('create', () => {
    it('composes mutation input correctly from all resolved fields', async () => {
      mockedResolveTeamId.mockResolvedValue('team-uuid')
      mockedResolveStateId.mockResolvedValue('state-uuid')
      mockedResolveUserId.mockResolvedValue('user-uuid')
      mockedResolveProjectId.mockResolvedValue('proj-uuid')
      mockedResolveIssueId.mockResolvedValue('parent-uuid')
      mockedResolveLabelIds.mockResolvedValue(['label-uuid'])
      mockedGraphql.mockResolvedValue({
        issueCreate: {
          success: true,
          issue: {
            id: 'new',
            identifier: 'ENG-100',
            url: 'u',
            title: 'New issue',
          },
        },
      })

      await createIssueTool().execute('call-1', {
        action: 'create',
        title: 'New issue',
        description: 'Details here',
        team: 'ENG',
        state: 'Todo',
        assignee: 'Alice',
        project: 'Alpha',
        parent: 'ENG-50',
        labels: ['Bug'],
        priority: 2,
        dueDate: '2026-06-01',
      })

      // Verify resolvers called with correct args
      expect(mockedResolveTeamId).toHaveBeenCalledWith('ENG')
      expect(mockedResolveStateId).toHaveBeenCalledWith('team-uuid', 'Todo')
      expect(mockedResolveUserId).toHaveBeenCalledWith('Alice')
      expect(mockedResolveProjectId).toHaveBeenCalledWith('Alpha')
      expect(mockedResolveIssueId).toHaveBeenCalledWith('ENG-50')
      expect(mockedResolveLabelIds).toHaveBeenCalledWith('team-uuid', ['Bug'])

      // Verify the mutation input
      const input = getMutationInput()
      expect(input.title).toBe('New issue')
      expect(input.teamId).toBe('team-uuid')
      expect(input.description).toBe('Details here')
      expect(input.priority).toBe(2)
      expect(input.stateId).toBe('state-uuid')
      expect(input.assigneeId).toBe('user-uuid')
      expect(input.projectId).toBe('proj-uuid')
      expect(input.parentId).toBe('parent-uuid')
      expect(input.labelIds).toEqual(['label-uuid'])
      expect(input.dueDate).toBe('2026-06-01')
    })

    it('fetches first available team when none specified', async () => {
      mockedGraphql.mockResolvedValueOnce({ teams: { nodes: [{ id: 'default-team' }] } }).mockResolvedValueOnce({
        issueCreate: {
          success: true,
          issue: { id: 'x', identifier: 'T-1', url: 'u', title: 'T' },
        },
      })

      await createIssueTool().execute('call-1', {
        action: 'create',
        title: 'Minimal',
      })

      const input = getMutationInput(1)
      expect(input.teamId).toBe('default-team')
    })

    it('returns error without title', async () => {
      const data = parse(await createIssueTool().execute('call-1', { action: 'create' }))
      expect(data.error).toContain('title is required')
    })

    it('returns error when no teams exist in workspace', async () => {
      mockedGraphql.mockResolvedValueOnce({ teams: { nodes: [] } })
      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'create',
          title: 'Orphaned',
        }),
      )
      expect(data.error).toContain('No teams found')
    })

    it('resolves milestone and passes projectMilestoneId when milestone and project provided', async () => {
      mockedResolveTeamId.mockResolvedValue('team-uuid')
      mockedResolveProjectId.mockResolvedValue('proj-uuid')
      mockedResolveMilestoneId.mockResolvedValue('milestone-uuid')
      mockedGraphql.mockResolvedValue({
        issueCreate: {
          success: true,
          issue: { id: 'new', identifier: 'ENG-101', url: 'u', title: 'Milestoned' },
        },
      })

      await createIssueTool().execute('call-1', {
        action: 'create',
        title: 'Milestoned',
        team: 'ENG',
        project: 'Alpha',
        milestone: 'RL3 v0.2.0',
      })

      expect(mockedResolveProjectId).toHaveBeenCalledWith('Alpha')
      expect(mockedResolveMilestoneId).toHaveBeenCalledWith('proj-uuid', 'RL3 v0.2.0')
      const input = getMutationInput()
      expect(input.projectMilestoneId).toBe('milestone-uuid')
    })

    it('returns error when milestone provided without project', async () => {
      mockedResolveTeamId.mockResolvedValue('team-uuid')
      mockedGraphql.mockResolvedValue({
        issueCreate: {
          success: true,
          issue: { id: 'new', identifier: 'ENG-102', url: 'u', title: 'T' },
        },
      })

      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'create',
          title: 'No project',
          team: 'ENG',
          milestone: 'M1',
        }),
      )
      expect(data.error).toContain('milestone requires project')
    })
  })

  describe('update', () => {
    it('appends description when appendDescription is true with existing content', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql
        .mockResolvedValueOnce({
          issue: { team: { id: 'team-1' }, description: 'Original' },
        })
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
          },
        })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        description: 'Appended',
        appendDescription: true,
      })

      const vars = mockedGraphql.mock.calls[1][1] as {
        input: Record<string, unknown>
      }
      expect(vars.input.description).toBe('Original\n\nAppended')
    })

    it('sets description directly when appendDescription is true but existing is empty', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql
        .mockResolvedValueOnce({
          issue: { team: { id: 'team-1' }, description: null },
        })
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
          },
        })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        description: 'Fresh',
        appendDescription: true,
      })

      const vars = mockedGraphql.mock.calls[1][1] as {
        input: Record<string, unknown>
      }
      expect(vars.input.description).toBe('Fresh')
    })

    it('clears dueDate when empty string is passed', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValue({
        issueUpdate: {
          success: true,
          issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
        },
      })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        dueDate: '',
      })

      const vars = mockedGraphql.mock.calls[0][1] as {
        input: Record<string, unknown>
      }
      expect(vars.input.dueDate).toBeNull()
    })

    it('resolves labels against the issue team', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedResolveLabelIds.mockResolvedValue(['label-bug'])
      mockedGraphql
        .mockResolvedValueOnce({
          issue: { team: { id: 'team-eng' }, description: null },
        })
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
          },
        })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        labels: ['Bug'],
      })

      expect(mockedResolveLabelIds).toHaveBeenCalledWith('team-eng', ['Bug'])
      const vars = mockedGraphql.mock.calls[1][1] as {
        input: Record<string, unknown>
      }
      expect(vars.input.labelIds).toEqual(['label-bug'])
    })

    it('returns error without issueId', async () => {
      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'update',
          title: 'No ID',
        }),
      )
      expect(data.error).toContain('issueId is required')
    })

    it('resolves milestone using existing project when no project param provided', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedResolveMilestoneId.mockResolvedValue('ms-uuid')
      mockedGraphql
        .mockResolvedValueOnce({
          issue: { team: { id: 'team-1' }, description: null, project: { id: 'existing-proj' } },
        })
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
          },
        })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        milestone: 'Sprint 1',
      })

      expect(mockedResolveMilestoneId).toHaveBeenCalledWith('existing-proj', 'Sprint 1')
      const vars = mockedGraphql.mock.calls[1][1] as { input: Record<string, unknown> }
      expect(vars.input.projectMilestoneId).toBe('ms-uuid')
    })

    it('resolves milestone using provided project param when both are given', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedResolveProjectId.mockResolvedValue('new-proj-uuid')
      mockedResolveMilestoneId.mockResolvedValue('ms-uuid-2')
      mockedGraphql
        .mockResolvedValueOnce({
          issue: { team: { id: 'team-1' }, description: null, project: { id: 'old-proj' } },
        })
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'T' },
          },
        })

      await createIssueTool().execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        project: 'NewProject',
        milestone: 'M2',
      })

      expect(mockedResolveMilestoneId).toHaveBeenCalledWith('new-proj-uuid', 'M2')
      const vars = mockedGraphql.mock.calls[1][1] as { input: Record<string, unknown> }
      expect(vars.input.projectMilestoneId).toBe('ms-uuid-2')
    })

    it('returns error when milestone set but issue has no project and no project param', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValueOnce({
        issue: { team: { id: 'team-1' }, description: null, project: null },
      })

      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'update',
          issueId: 'ENG-42',
          milestone: 'M1',
        }),
      )
      expect(data.error).toContain('milestone requires')
    })
  })

  describe('delete', () => {
    it('resolves identifier and sends delete mutation', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-42')
      mockedGraphql.mockResolvedValue({ issueDelete: { success: true } })

      const data = parse(
        await createIssueTool().execute('call-1', {
          action: 'delete',
          issueId: 'ENG-42',
        }),
      )

      expect(mockedResolveIssueId).toHaveBeenCalledWith('ENG-42')
      const vars = mockedGraphql.mock.calls[0][1] as { id: string }
      expect(vars.id).toBe('uuid-42')
      expect(data.success).toBe(true)
      expect(data.issueId).toBe('ENG-42')
    })

    it('returns error without issueId', async () => {
      const data = parse(await createIssueTool().execute('call-1', { action: 'delete' }))
      expect(data.error).toContain('issueId is required')
    })
  })

  it('surfaces API errors as structured error response rather than throwing', async () => {
    mockedResolveIssueId.mockRejectedValue(new Error('Network failure'))

    const data = parse(
      await createIssueTool().execute('call-1', {
        action: 'view',
        issueId: 'ENG-1',
      }),
    )
    expect(data.error).toContain('Network failure')
  })
})
