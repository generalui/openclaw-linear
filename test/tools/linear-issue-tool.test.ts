import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/linear-api.js', () => ({
  graphql: vi.fn(),
  resolveIssueId: vi.fn(),
  resolveTeamId: vi.fn(),
  resolveStateId: vi.fn(),
  resolveUserId: vi.fn(),
  resolveLabelIds: vi.fn(),
  resolveProjectId: vi.fn(),
}))

const { graphql, resolveIssueId, resolveTeamId, resolveStateId, resolveUserId, resolveLabelIds, resolveProjectId } =
  await import('../../src/linear-api.js')
const { createIssueTool } = await import('../../src/tools/linear-issue-tool.js')

const mockedGraphql = vi.mocked(graphql)
const mockedResolveIssueId = vi.mocked(resolveIssueId)
const mockedResolveTeamId = vi.mocked(resolveTeamId)
const mockedResolveStateId = vi.mocked(resolveStateId)
const mockedResolveUserId = vi.mocked(resolveUserId)
const mockedResolveLabelIds = vi.mocked(resolveLabelIds)
const mockedResolveProjectId = vi.mocked(resolveProjectId)

function parse(result: { content: { type: string; text?: string }[] }) {
  const text = result.content.find((c) => c.type === 'text')?.text
  return text ? JSON.parse(text) : undefined
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linear_issue tool', () => {
  it('has correct name', () => {
    const tool = createIssueTool()
    expect(tool.name).toBe('linear_issue')
  })

  describe('view', () => {
    it('returns issue details', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      const issue = {
        id: 'uuid-1',
        identifier: 'ENG-42',
        title: 'Fix bug',
        state: { name: 'Todo' },
      }
      mockedGraphql.mockResolvedValue({ issue })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'view',
        issueId: 'ENG-42',
      })
      const data = parse(result)
      expect(data.identifier).toBe('ENG-42')
      expect(data.title).toBe('Fix bug')
    })

    it('returns error without issueId', async () => {
      const tool = createIssueTool()
      const result = await tool.execute('call-1', { action: 'view' })
      const data = parse(result)
      expect(data.error).toContain('issueId is required')
    })
  })

  describe('list', () => {
    it('returns filtered issues', async () => {
      mockedGraphql.mockResolvedValue({
        issues: {
          nodes: [
            { id: 'i1', identifier: 'ENG-1', title: 'Task 1' },
            { id: 'i2', identifier: 'ENG-2', title: 'Task 2' },
          ],
        },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'list',
        state: 'In Progress',
        team: 'ENG',
      })
      const data = parse(result)
      expect(data.issues).toHaveLength(2)
    })

    it('lists without filters', async () => {
      mockedGraphql.mockResolvedValue({
        issues: { nodes: [] },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', { action: 'list' })
      const data = parse(result)
      expect(data.issues).toEqual([])
    })
  })

  describe('create', () => {
    it('creates an issue with all fields', async () => {
      mockedResolveTeamId.mockResolvedValue('team-1')
      mockedResolveStateId.mockResolvedValue('state-1')
      mockedResolveUserId.mockResolvedValue('user-1')
      mockedResolveProjectId.mockResolvedValue('proj-1')
      mockedResolveIssueId.mockResolvedValue('parent-uuid')
      mockedResolveLabelIds.mockResolvedValue(['label-1'])
      mockedGraphql.mockResolvedValue({
        issueCreate: {
          success: true,
          issue: {
            id: 'new-id',
            identifier: 'ENG-100',
            url: 'https://linear.app/eng/issue/ENG-100',
            title: 'New issue',
          },
        },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'create',
        title: 'New issue',
        description: 'Details',
        team: 'ENG',
        state: 'Todo',
        assignee: 'Alice',
        project: 'Alpha',
        parent: 'ENG-50',
        labels: ['Bug'],
        priority: 2,
      })
      const data = parse(result)
      expect(data.success).toBe(true)
      expect(data.issue.identifier).toBe('ENG-100')
    })

    it('returns error without title', async () => {
      const tool = createIssueTool()
      const result = await tool.execute('call-1', { action: 'create' })
      const data = parse(result)
      expect(data.error).toContain('title is required')
    })

    it('fetches default team when none specified', async () => {
      mockedGraphql.mockResolvedValueOnce({ teams: { nodes: [{ id: 'default-team' }] } }).mockResolvedValueOnce({
        issueCreate: {
          success: true,
          issue: { id: 'x', identifier: 'T-1', url: 'u', title: 'T' },
        },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'create',
        title: 'Minimal',
      })
      const data = parse(result)
      expect(data.success).toBe(true)
    })
  })

  describe('update', () => {
    it('updates issue fields', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValueOnce({ issue: { team: { id: 'team-1' } } }).mockResolvedValueOnce({
        issueUpdate: {
          success: true,
          issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Updated' },
        },
      })
      mockedResolveStateId.mockResolvedValue('state-done')

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        state: 'Done',
        title: 'Updated',
      })
      const data = parse(result)
      expect(data.success).toBe(true)
    })

    it('returns error without issueId', async () => {
      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'update',
        title: 'No ID',
      })
      const data = parse(result)
      expect(data.error).toContain('issueId is required')
    })

    it('appends to existing description when appendDescription is true', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql
        // First call: fetch team + existing description
        .mockResolvedValueOnce({ issue: { team: { id: 'team-1' }, description: 'Original content.' } })
        // Second call: the update mutation
        .mockResolvedValueOnce({
          issueUpdate: {
            success: true,
            issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' },
          },
        })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        description: 'Appended note.',
        appendDescription: true,
      })
      const data = parse(result)
      expect(data.success).toBe(true)

      // Verify the mutation was called with the concatenated description
      const mutationCall = mockedGraphql.mock.calls[1] as [string, Record<string, unknown>]
      const input = mutationCall[1].input as Record<string, string>
      expect(input.description).toBe('Original content.\n\nAppended note.')
    })

    it('sets description directly (no append) when appendDescription is false', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValueOnce({
        issueUpdate: {
          success: true,
          issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' },
        },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        description: 'Replacement description.',
      })
      const data = parse(result)
      expect(data.success).toBe(true)

      // Only one graphql call (no fetch for existing description)
      expect(mockedGraphql).toHaveBeenCalledOnce()
      const call = mockedGraphql.mock.calls[0] as [string, Record<string, unknown>]
      const input = call[1].input as Record<string, string>
      expect(input.description).toBe('Replacement description.')
    })

    it('appends to empty description when existing description is absent', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql
        .mockResolvedValueOnce({ issue: { team: { id: 'team-1' }, description: undefined } })
        .mockResolvedValueOnce({
          issueUpdate: { success: true, issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' } },
        })

      const tool = createIssueTool()
      await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        description: 'First note.',
        appendDescription: true,
      })

      const mutationCall = mockedGraphql.mock.calls[1] as [string, Record<string, unknown>]
      const input = mutationCall[1].input as Record<string, string>
      // No prefix when existing description is empty
      expect(input.description).toBe('First note.')
    })

    it('updates labels via resolveLabelIds', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedResolveLabelIds.mockResolvedValue(['label-bug', 'label-feat'])
      mockedGraphql.mockResolvedValueOnce({ issue: { team: { id: 'team-1' } } }).mockResolvedValueOnce({
        issueUpdate: { success: true, issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' } },
      })

      const tool = createIssueTool()
      await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        labels: ['Bug', 'Feature'],
      })

      expect(mockedResolveLabelIds).toHaveBeenCalledWith('team-1', ['Bug', 'Feature'])

      const mutationCall = mockedGraphql.mock.calls[1] as [string, Record<string, unknown>]
      const input = mutationCall[1].input as Record<string, unknown>
      expect(input.labelIds).toEqual(['label-bug', 'label-feat'])
    })

    it('clears dueDate when empty string is passed', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValueOnce({
        issueUpdate: { success: true, issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' } },
      })

      const tool = createIssueTool()
      await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        dueDate: '',
      })

      const call = mockedGraphql.mock.calls[0] as [string, Record<string, unknown>]
      const input = call[1].input as Record<string, unknown>
      expect(input.dueDate).toBeNull()
    })

    it('sets dueDate when a date string is passed', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValueOnce({
        issueUpdate: { success: true, issue: { id: 'uuid-1', identifier: 'ENG-42', title: 'Task' } },
      })

      const tool = createIssueTool()
      await tool.execute('call-1', {
        action: 'update',
        issueId: 'ENG-42',
        dueDate: '2026-03-18',
      })

      const call = mockedGraphql.mock.calls[0] as [string, Record<string, unknown>]
      const input = call[1].input as Record<string, unknown>
      expect(input.dueDate).toBe('2026-03-18')
    })
  })

  describe('delete', () => {
    it('deletes an issue', async () => {
      mockedResolveIssueId.mockResolvedValue('uuid-1')
      mockedGraphql.mockResolvedValue({
        issueDelete: { success: true },
      })

      const tool = createIssueTool()
      const result = await tool.execute('call-1', {
        action: 'delete',
        issueId: 'ENG-42',
      })
      const data = parse(result)
      expect(data.success).toBe(true)
    })

    it('returns error without issueId', async () => {
      const tool = createIssueTool()
      const result = await tool.execute('call-1', { action: 'delete' })
      const data = parse(result)
      expect(data.error).toContain('issueId is required')
    })
  })

  it('catches and returns errors from the API', async () => {
    mockedResolveIssueId.mockRejectedValue(new Error('Network failure'))

    const tool = createIssueTool()
    const result = await tool.execute('call-1', {
      action: 'view',
      issueId: 'ENG-1',
    })
    const data = parse(result)
    expect(data.error).toContain('Network failure')
  })
})
