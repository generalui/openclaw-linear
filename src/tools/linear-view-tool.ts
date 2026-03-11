import { Type, type Static } from '@sinclair/typebox'
import { type AnyAgentTool, jsonResult, stringEnum, formatErrorMessage } from 'openclaw/plugin-sdk'
import { graphql } from '../linear-api.js'

const Params = Type.Object({
  action: stringEnum(['list', 'get', 'create', 'update', 'delete'] as const, {
    description:
      'list: show all custom views. ' +
      'get: get a specific view by id. ' +
      'create: create a new view. ' +
      'update: update an existing view. ' +
      'delete: delete a view.',
  }),
  viewId: Type.Optional(
    Type.String({
      description: 'View ID. Required for get, update, delete.',
    }),
  ),
  name: Type.Optional(Type.String({ description: 'View name. Required for create.' })),
  description: Type.Optional(Type.String({ description: 'View description.' })),
  icon: Type.Optional(Type.String({ description: 'View icon.' })),
  color: Type.Optional(Type.String({ description: 'View color.' })),
  filterData: Type.Optional(
    Type.String({
      description: 'JSON string of filter data for the view (Linear filter format).',
    }),
  ),
  shared: Type.Optional(
    Type.Boolean({
      description: 'Whether the view is shared with the team.',
    }),
  ),
})

type Params = Static<typeof Params>

const LIST_VIEWS_QUERY = `
  query ListCustomViews {
    customViews {
      nodes {
        id
        name
        description
        icon
        color
        shared
        creator { name email }
        updatedAt
      }
    }
  }
`

const GET_VIEW_QUERY = `
  query GetCustomView($id: String!) {
    customView(id: $id) {
      id
      name
      description
      icon
      color
      shared
      creator { name email }
      updatedAt
    }
  }
`

const CREATE_VIEW_MUTATION = `
  mutation CreateCustomView($input: CustomViewCreateInput!) {
    customViewCreate(input: $input) {
      success
      customView { id name }
    }
  }
`

const UPDATE_VIEW_MUTATION = `
  mutation UpdateCustomView($id: String!, $input: CustomViewUpdateInput!) {
    customViewUpdate(id: $id, input: $input) {
      success
      customView { id name }
    }
  }
`

const DELETE_VIEW_MUTATION = `
  mutation DeleteCustomView($id: String!) {
    customViewDelete(id: $id) {
      success
    }
  }
`

async function listViews() {
  const data = await graphql<{ customViews: { nodes: unknown[] } }>(LIST_VIEWS_QUERY)
  const views = data?.customViews?.nodes ?? []
  return jsonResult({ count: views.length, views })
}

async function getView(viewId: string) {
  const data = await graphql<{ customView: unknown }>(GET_VIEW_QUERY, { id: viewId })
  return jsonResult(data?.customView ?? null)
}

async function createView(params: Params) {
  if (!params.name) throw new Error('name is required for create')
  const input: Record<string, unknown> = { name: params.name }
  if (params.description !== undefined) input.description = params.description
  if (params.icon !== undefined) input.icon = params.icon
  if (params.color !== undefined) input.color = params.color
  if (params.filterData !== undefined) input.filterData = JSON.parse(params.filterData) as unknown
  if (params.shared !== undefined) input.shared = params.shared
  const data = await graphql<{ customViewCreate: unknown }>(CREATE_VIEW_MUTATION, { input })
  return jsonResult(data?.customViewCreate ?? null)
}

async function updateView(viewId: string, params: Params) {
  const input: Record<string, unknown> = {}
  if (params.name !== undefined) input.name = params.name
  if (params.description !== undefined) input.description = params.description
  if (params.icon !== undefined) input.icon = params.icon
  if (params.color !== undefined) input.color = params.color
  if (params.filterData !== undefined) input.filterData = JSON.parse(params.filterData) as unknown
  if (params.shared !== undefined) input.shared = params.shared
  const data = await graphql<{ customViewUpdate: unknown }>(UPDATE_VIEW_MUTATION, { id: viewId, input })
  return jsonResult(data?.customViewUpdate ?? null)
}

async function deleteView(viewId: string) {
  const data = await graphql<{ customViewDelete: unknown }>(DELETE_VIEW_MUTATION, { id: viewId })
  return jsonResult(data?.customViewDelete ?? null)
}

export function createViewTool(): AnyAgentTool {
  return {
    name: 'linear_view',
    label: 'Linear View',
    description: 'Manage Linear custom views. Actions: list, get, create, update, delete.',
    parameters: Params,
    async execute(_toolCallId: string, params: Params) {
      try {
        if (params.action === 'list') return await listViews()
        if (params.action === 'get') {
          if (!params.viewId) throw new Error('viewId is required for get')
          return await getView(params.viewId)
        }
        if (params.action === 'create') return await createView(params)
        if (params.action === 'update') {
          if (!params.viewId) throw new Error('viewId is required for update')
          return await updateView(params.viewId, params)
        }
        if (params.action === 'delete') {
          if (!params.viewId) throw new Error('viewId is required for delete')
          return await deleteView(params.viewId)
        }
        throw new Error(`Unknown action: ${params.action as string}`)
      } catch (err) {
        return jsonResult({ error: formatErrorMessage(err) })
      }
    },
  }
}
