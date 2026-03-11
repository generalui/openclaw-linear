/**
 * Tests for linear-api.ts resolver functions.
 *
 * The graphql() function itself is mocked globally via vi.stubGlobal('fetch', ...)
 * so we can verify HTTP behaviour without hitting the network.
 * Resolver functions (resolveIssueId, resolveStateId, etc.) are tested against
 * the mocked graphql layer to verify their parsing/matching/caching logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setApiKey,
  _resetApiKey,
  _resetIssueIdCache,
  graphql,
  resolveIssueId,
  resolveTeamId,
  resolveStateId,
  resolveUserId,
  resolveLabelIds,
  resolveProjectId,
} from '../src/linear-api.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  })
}

beforeEach(() => {
  setApiKey('test-api-key')
  _resetIssueIdCache()
})

afterEach(() => {
  _resetApiKey()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// graphql()
// ---------------------------------------------------------------------------

describe('graphql()', () => {
  it('throws when API key is not set', async () => {
    _resetApiKey()
    await expect(graphql('{ viewer { id } }')).rejects.toThrow('Linear API key not set')
  })

  it('sends POST to Linear API with correct headers and body', async () => {
    const fetchMock = mockFetch({ data: { viewer: { id: 'u1' } } })
    vi.stubGlobal('fetch', fetchMock)

    await graphql<{ viewer: { id: string } }>('{ viewer { id } }', { foo: 'bar' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.linear.app/graphql')
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('test-api-key')
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    const body = JSON.parse(options.body as string) as { query: string; variables: Record<string, unknown> }
    expect(body.query).toBe('{ viewer { id } }')
    expect(body.variables).toEqual({ foo: 'bar' })
  })

  it('returns data from successful response', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { viewer: { id: 'u1' } } }))
    const result = await graphql<{ viewer: { id: string } }>('{ viewer { id } }')
    expect(result.viewer.id).toBe('u1')
  })

  it('throws on HTTP error status', async () => {
    vi.stubGlobal('fetch', mockFetch({ message: 'Unauthorized' }, 401))
    await expect(graphql('{ viewer { id } }')).rejects.toThrow('Linear API HTTP 401')
  })

  it('throws on GraphQL-level errors', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: null, errors: [{ message: 'Not found' }] }))
    await expect(graphql('{ viewer { id } }')).rejects.toThrow('Linear API error: Not found')
  })

  it('handles missing variables (sends no variables key in body)', async () => {
    const fetchMock = mockFetch({ data: {} })
    vi.stubGlobal('fetch', fetchMock)
    await graphql('{ viewer { id } }')
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      variables?: unknown
    }
    // variables should be undefined/absent when not passed
    expect(body.variables).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveIssueId()
// ---------------------------------------------------------------------------

describe('resolveIssueId()', () => {
  it('resolves a valid identifier (ENG-42) to a UUID', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { issues: { nodes: [{ id: 'uuid-abc' }] } } }))
    const id = await resolveIssueId('ENG-42')
    expect(id).toBe('uuid-abc')
  })

  it('uppercases the team key in the query', async () => {
    const fetchMock = mockFetch({ data: { issues: { nodes: [{ id: 'uuid-1' }] } } })
    vi.stubGlobal('fetch', fetchMock)
    await resolveIssueId('eng-42')
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      variables: { teamKey: string; num: number }
    }
    expect(body.variables.teamKey).toBe('ENG')
    expect(body.variables.num).toBe(42)
  })

  it('throws for non-identifier format (plain UUID / non-matching string)', async () => {
    await expect(resolveIssueId('not-an-id')).rejects.toThrow('Invalid issue identifier format')
    await expect(resolveIssueId('12345')).rejects.toThrow('Invalid issue identifier format')
    await expect(resolveIssueId('')).rejects.toThrow('Invalid issue identifier format')
  })

  it('throws when issue is not found', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { issues: { nodes: [] } } }))
    await expect(resolveIssueId('ENG-999')).rejects.toThrow('Issue ENG-999 not found')
  })

  it('caches the result on second call (fetch called once)', async () => {
    const fetchMock = mockFetch({ data: { issues: { nodes: [{ id: 'uuid-cached' }] } } })
    vi.stubGlobal('fetch', fetchMock)

    const id1 = await resolveIssueId('ENG-10')
    const id2 = await resolveIssueId('ENG-10')

    expect(id1).toBe('uuid-cached')
    expect(id2).toBe('uuid-cached')
    expect(fetchMock).toHaveBeenCalledOnce() // second call hits cache
  })

  it('_resetIssueIdCache clears the cache (fetch called again)', async () => {
    const fetchMock = mockFetch({ data: { issues: { nodes: [{ id: 'uuid-fresh' }] } } })
    vi.stubGlobal('fetch', fetchMock)

    await resolveIssueId('ENG-10')
    _resetIssueIdCache()
    await resolveIssueId('ENG-10')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caches different identifiers independently', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { issues: { nodes: [{ id: 'uuid-1' }] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { issues: { nodes: [{ id: 'uuid-2' }] } } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const id1 = await resolveIssueId('ENG-1')
    const id2 = await resolveIssueId('ENG-2')

    expect(id1).toBe('uuid-1')
    expect(id2).toBe('uuid-2')
  })
})

// ---------------------------------------------------------------------------
// resolveTeamId()
// ---------------------------------------------------------------------------

describe('resolveTeamId()', () => {
  it('returns team UUID for a matching key', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { teams: { nodes: [{ id: 'team-uuid' }] } } }))
    const id = await resolveTeamId('ENG')
    expect(id).toBe('team-uuid')
  })

  it('uppercases the team key in the query', async () => {
    const fetchMock = mockFetch({ data: { teams: { nodes: [{ id: 'team-uuid' }] } } })
    vi.stubGlobal('fetch', fetchMock)
    await resolveTeamId('eng')
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      variables: { key: string }
    }
    expect(body.variables.key).toBe('ENG')
  })

  it('throws when team is not found', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { teams: { nodes: [] } } }))
    await expect(resolveTeamId('NOPE')).rejects.toThrow('Team with key "NOPE" not found')
  })
})

// ---------------------------------------------------------------------------
// resolveStateId()
// ---------------------------------------------------------------------------

describe('resolveStateId()', () => {
  const states = {
    data: {
      team: {
        states: {
          nodes: [
            { id: 'state-todo', name: 'Todo' },
            { id: 'state-done', name: 'Done' },
            { id: 'state-prog', name: 'In Progress' },
          ],
        },
      },
    },
  }

  it('returns state UUID for exact name match', async () => {
    vi.stubGlobal('fetch', mockFetch(states))
    const id = await resolveStateId('team-1', 'Todo')
    expect(id).toBe('state-todo')
  })

  it('matches state name case-insensitively', async () => {
    vi.stubGlobal('fetch', mockFetch(states))
    const id = await resolveStateId('team-1', 'todo')
    expect(id).toBe('state-todo')
  })

  it('matches multi-word state names case-insensitively', async () => {
    vi.stubGlobal('fetch', mockFetch(states))
    const id = await resolveStateId('team-1', 'in progress')
    expect(id).toBe('state-prog')
  })

  it('throws when state not found and lists available states', async () => {
    vi.stubGlobal('fetch', mockFetch(states))
    await expect(resolveStateId('team-1', 'Unknown')).rejects.toThrow(
      'Workflow state "Unknown" not found. Available states: Todo, Done, In Progress',
    )
  })
})

// ---------------------------------------------------------------------------
// resolveUserId()
// ---------------------------------------------------------------------------

describe('resolveUserId()', () => {
  it('resolves a user by name', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { users: { nodes: [{ id: 'user-uuid' }] } } }))
    const id = await resolveUserId('Alice')
    expect(id).toBe('user-uuid')
  })

  it('resolves a user by email', async () => {
    const fetchMock = mockFetch({ data: { users: { nodes: [{ id: 'user-uuid' }] } } })
    vi.stubGlobal('fetch', fetchMock)
    await resolveUserId('alice@example.com')
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      variables: { term: string }
    }
    expect(body.variables.term).toBe('alice@example.com')
  })

  it('throws when user not found', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { users: { nodes: [] } } }))
    await expect(resolveUserId('Nobody')).rejects.toThrow('User "Nobody" not found')
  })
})

// ---------------------------------------------------------------------------
// resolveLabelIds()
// ---------------------------------------------------------------------------

describe('resolveLabelIds()', () => {
  const labelData = {
    data: {
      team: {
        labels: {
          nodes: [
            { id: 'label-bug', name: 'Bug' },
            { id: 'label-feat', name: 'Feature' },
            { id: 'label-docs', name: 'Documentation' },
          ],
        },
      },
    },
  }

  it('returns IDs for matching label names', async () => {
    vi.stubGlobal('fetch', mockFetch(labelData))
    const ids = await resolveLabelIds('team-1', ['Bug', 'Feature'])
    expect(ids).toEqual(['label-bug', 'label-feat'])
  })

  it('matches label names case-insensitively', async () => {
    vi.stubGlobal('fetch', mockFetch(labelData))
    const ids = await resolveLabelIds('team-1', ['bug', 'FEATURE'])
    expect(ids).toEqual(['label-bug', 'label-feat'])
  })

  it('returns empty array for empty name list', async () => {
    vi.stubGlobal('fetch', mockFetch(labelData))
    const ids = await resolveLabelIds('team-1', [])
    expect(ids).toEqual([])
  })

  it('throws when a label is not found', async () => {
    vi.stubGlobal('fetch', mockFetch(labelData))
    await expect(resolveLabelIds('team-1', ['Bug', 'Nonexistent'])).rejects.toThrow(
      'Label "Nonexistent" not found in team',
    )
  })

  it('preserves label ID order matching input name order', async () => {
    vi.stubGlobal('fetch', mockFetch(labelData))
    const ids = await resolveLabelIds('team-1', ['Documentation', 'Bug'])
    expect(ids).toEqual(['label-docs', 'label-bug'])
  })
})

// ---------------------------------------------------------------------------
// resolveProjectId()
// ---------------------------------------------------------------------------

describe('resolveProjectId()', () => {
  it('returns project UUID for a matching name', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        data: {
          projects: { nodes: [{ id: 'proj-uuid', name: 'My Project' }] },
        },
      }),
    )
    const id = await resolveProjectId('My Project')
    expect(id).toBe('proj-uuid')
  })

  it('throws when project not found', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { projects: { nodes: [] } } }))
    await expect(resolveProjectId('Ghost Project')).rejects.toThrow('Project "Ghost Project" not found')
  })
})
