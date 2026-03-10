import { Type, type Static } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { jsonResult, stringEnum, formatErrorMessage } from "openclaw/plugin-sdk";
import { graphql } from "../linear-api.js";

const Params = Type.Object({
  action: stringEnum(
    ["list", "get", "create", "update", "delete"] as const,
    {
      description:
        "list: list all custom views. " +
        "get: get a specific view by ID. " +
        "create: create a new custom view. " +
        "update: update an existing view. " +
        "delete: delete a view.",
    },
  ),
  viewId: Type.Optional(
    Type.String({
      description: "View ID. Required for get, update, delete.",
    }),
  ),
  name: Type.Optional(
    Type.String({ description: "View name. Required for create." }),
  ),
  description: Type.Optional(
    Type.String({ description: "View description." }),
  ),
  icon: Type.Optional(
    Type.String({ description: "View icon name." }),
  ),
  color: Type.Optional(
    Type.String({ description: "View color (hex string, e.g. '#FF0000')." }),
  ),
  shared: Type.Optional(
    Type.Boolean({ description: "Whether the view is shared with the team." }),
  ),
  filterData: Type.Optional(
    Type.Unknown({
      description: "Filter data object for the view (Linear FilterInput JSON).",
    }),
  ),
});

type Params = Static<typeof Params>;

const VIEW_FIELDS = `
  id
  name
  description
  icon
  color
  shared
  filterData
  creator { name }
  updatedAt
`;

export function createViewTool(): AnyAgentTool {
  return {
    name: "linear_view",
    description:
      "Manage Linear custom views. Actions: list, get, create, update, delete.",
    parameters: Params,
    async execute(params: Params) {
      try {
        switch (params.action) {
          case "list": {
            const data = await graphql<{
              customViews: { nodes: unknown[] };
            }>(
              `query {
                customViews {
                  nodes {
                    ${VIEW_FIELDS}
                  }
                }
              }`,
            );
            return jsonResult(data.customViews.nodes);
          }

          case "get": {
            if (!params.viewId) {
              throw new Error("viewId is required for get");
            }
            const data = await graphql<{
              customView: unknown;
            }>(
              `query($id: String!) {
                customView(id: $id) {
                  ${VIEW_FIELDS}
                }
              }`,
              { id: params.viewId },
            );
            return jsonResult(data.customView);
          }

          case "create": {
            if (!params.name) {
              throw new Error("name is required for create");
            }
            const input: Record<string, unknown> = { name: params.name };
            if (params.description !== undefined) input.description = params.description;
            if (params.icon !== undefined) input.icon = params.icon;
            if (params.color !== undefined) input.color = params.color;
            if (params.shared !== undefined) input.shared = params.shared;
            if (params.filterData !== undefined) input.filterData = params.filterData;

            const data = await graphql<{
              customViewCreate: { success: boolean; customView: unknown };
            }>(
              `mutation($input: CustomViewCreateInput!) {
                customViewCreate(input: $input) {
                  success
                  customView {
                    ${VIEW_FIELDS}
                  }
                }
              }`,
              { input },
            );
            return jsonResult(data.customViewCreate);
          }

          case "update": {
            if (!params.viewId) {
              throw new Error("viewId is required for update");
            }
            const input: Record<string, unknown> = {};
            if (params.name !== undefined) input.name = params.name;
            if (params.description !== undefined) input.description = params.description;
            if (params.icon !== undefined) input.icon = params.icon;
            if (params.color !== undefined) input.color = params.color;
            if (params.shared !== undefined) input.shared = params.shared;
            if (params.filterData !== undefined) input.filterData = params.filterData;

            const data = await graphql<{
              customViewUpdate: { success: boolean; customView: unknown };
            }>(
              `mutation($id: String!, $input: CustomViewUpdateInput!) {
                customViewUpdate(id: $id, input: $input) {
                  success
                  customView {
                    ${VIEW_FIELDS}
                  }
                }
              }`,
              { id: params.viewId, input },
            );
            return jsonResult(data.customViewUpdate);
          }

          case "delete": {
            if (!params.viewId) {
              throw new Error("viewId is required for delete");
            }
            const data = await graphql<{
              customViewDelete: { success: boolean };
            }>(
              `mutation($id: String!) {
                customViewDelete(id: $id) {
                  success
                }
              }`,
              { id: params.viewId },
            );
            return jsonResult(data.customViewDelete);
          }

          default:
            throw new Error(`Unknown action: ${(params as Params).action}`);
        }
      } catch (err) {
        return { error: formatErrorMessage(err) };
      }
    },
  };
}
