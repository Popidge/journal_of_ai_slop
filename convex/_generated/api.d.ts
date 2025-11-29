/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as crons from "../crons.js";
import type * as environmentalImpact from "../environmentalImpact.js";
import type * as migrations_eco_mode_migration from "../migrations/eco_mode_migration.js";
import type * as papers from "../papers.js";
import type * as papersQueue from "../papersQueue.js";
import type * as slopId from "../slopId.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  crons: typeof crons;
  environmentalImpact: typeof environmentalImpact;
  "migrations/eco_mode_migration": typeof migrations_eco_mode_migration;
  papers: typeof papers;
  papersQueue: typeof papersQueue;
  slopId: typeof slopId;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
