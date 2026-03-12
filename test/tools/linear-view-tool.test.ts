import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/linear-api.js', () => ({
  graphql: vi.fn(),
}))

const { graphql } = await import('../../src/linear-api.js')
const { createViewTool } = await import('../../src/tools/linear-view-tool.js')

const mockedGraphql = vi.mocked(graphql)

function parse(result: { content: { type: string; text?: string }[] }) {
  const text = result.content.find((c) => c.type === 'text')?.text
  return text ? JSON.parse(text) : undefined
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linear_view tool', () => {
  describe('list', () => {
    it('returns all custom views', async () => {
      mockedGraphql.mockResolvedValue({
        customViews: {
          nodes: [
            {
              id: 'view-1',
              name: 'My Issues',
              description: 'Issues assigned to me',
              shared: false,
              creator: { name: 'Alice', email: 'alice@example.com' },
              updatedAt: '2025-01-01T00:00:00Z',
            },
            {
              id: 'view-2',
              name: 'Team Backlog',
              description: null,
              shared: true,
              creator: { name: 'Bob', email: 'bob@example.com' },
              updatedAt: '2025-01-02T00:00:00Z',
            },
          ],
        },
      })

      const data = parse(await createViewTool().execute('call-1', { action: 'list' }))
      expect(data.count).toBe(2)
      expect(data.views[0].name).toBe('My Issues')
      expect(data.views[1].name).toBe('Team Backlog')
    })

    it('returns empty list when no views exist', async () => {
      mockedGraphql.mockResolvedValue({ customViews: { nodes: [] } })

      const data = parse(await createViewTool().execute('call-1', { action: 'list' }))
      expect(data.count).toBe(0)
      expect(data.views).toEqual([])
    })
  })

  describe('get', () => {
    it('fetches view by id and passes viewId as variable', async () => {
      mockedGraphql.mockResolvedValue({
        customView: { id: 'view-1', name: 'My Issues' },
      })

      const data = parse(
        await createViewTool().execute('call-1', {
          action: 'get',
          viewId: 'view-1',
        }),
      )

      const vars = mockedGraphql.mock.calls[0][1]
      expect(vars).toEqual({ id: 'view-1' })
      expect(data.name).toBe('My Issues')
    })

    it('returns null when view is not found', async () => {
      mockedGraphql.mockResolvedValue({ customView: null })

      const data = parse(
        await createViewTool().execute('call-1', {
          action: 'get',
          viewId: 'nonexistent',
        }),
      )
      expect(data).toBeNull()
    })

    it('returns error when viewId is missing', async () => {
      const data = parse(await createViewTool().execute('call-1', { action: 'get' }))
      expect(data.error).toContain('viewId is required')
    })
  })

  describe('create', () => {
    it('sends all optional fields in the mutation input', async () => {
      mockedGraphql.mockResolvedValue({
        customViewCreate: {
          success: true,
          customView: { id: 'view-new', name: 'Full View' },
        },
      })

      await createViewTool().execute('call-1', {
        action: 'create',
        name: 'Full View',
        description: 'A complete view',
        icon: 'Eye',
        color: '#00FF00',
        filterData: '{"assignee":{"id":{"eq":"user-1"}}}',
        shared: true,
      })

      const vars = mockedGraphql.mock.calls[0][1] as {
        input: Record<string, unknown>
      }
      expect(vars.input.name).toBe('Full View')
      expect(vars.input.description).toBe('A complete view')
      expect(vars.input.icon).toBe('Eye')
      expect(vars.input.color).toBe('#00FF00')
      expect(vars.input.shared).toBe(true)
      expect(vars.input.filterData).toEqual({
        assignee: { id: { eq: 'user-1' } },
      })
    })

    it('returns error when name is missing', async () => {
      const data = parse(await createViewTool().execute('call-1', { action: 'create' }))
      expect(data.error).toContain('name is required')
    })

    it('returns error when filterData is invalid JSON', async () => {
      const data = parse(
        await createViewTool().execute('call-1', {
          action: 'create',
          name: 'Bad Filter',
          filterData: '{ not valid json',
        }),
      )
      expect(data.error).toBeDefined()
    })
  })

  describe('update', () => {
    it('sends viewId and all provided fields as mutation variables', async () => {
      mockedGraphql.mockResolvedValue({
        customViewUpdate: {
          success: true,
          customView: { id: 'view-1', name: 'Updated' },
        },
      })

      await createViewTool().execute('call-1', {
        action: 'update',
        viewId: 'view-1',
        name: 'Updated',
        description: 'New desc',
        icon: 'Check',
        color: '#0000FF',
        shared: false,
        filterData: '{"state":{"type":{"eq":"started"}}}',
      })

      const vars = mockedGraphql.mock.calls[0][1] as {
        id: string
        input: Record<string, unknown>
      }
      expect(vars.id).toBe('view-1')
      expect(vars.input.name).toBe('Updated')
      expect(vars.input.description).toBe('New desc')
      expect(vars.input.icon).toBe('Check')
      expect(vars.input.color).toBe('#0000FF')
      expect(vars.input.shared).toBe(false)
      expect(vars.input.filterData).toEqual({
        state: { type: { eq: 'started' } },
      })
    })

    it('returns error when viewId is missing', async () => {
      const data = parse(
        await createViewTool().execute('call-1', {
          action: 'update',
          name: 'No ID',
        }),
      )
      expect(data.error).toContain('viewId is required')
    })
  })

  describe('delete', () => {
    it('sends viewId as mutation variable', async () => {
      mockedGraphql.mockResolvedValue({ customViewDelete: { success: true } })

      const data = parse(
        await createViewTool().execute('call-1', {
          action: 'delete',
          viewId: 'view-99',
        }),
      )

      const vars = mockedGraphql.mock.calls[0][1]
      expect(vars).toEqual({ id: 'view-99' })
      expect(data.success).toBe(true)
    })

    it('returns error when viewId is missing', async () => {
      const data = parse(await createViewTool().execute('call-1', { action: 'delete' }))
      expect(data.error).toContain('viewId is required')
    })
  })

  it('surfaces API errors as structured error response rather than throwing', async () => {
    mockedGraphql.mockRejectedValue(new Error('Rate limit exceeded'))

    const data = parse(await createViewTool().execute('call-1', { action: 'list' }))
    expect(data.error).toContain('Rate limit exceeded')
  })
})
