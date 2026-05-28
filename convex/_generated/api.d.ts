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
import type * as carbonLedger from "../carbonLedger.js";
import type * as crons from "../crons.js";
import type * as editorsComments from "../editorsComments.js";
import type * as environmentalImpact from "../environmentalImpact.js";
import type * as http from "../http.js";
import type * as migrations_carbon_ledger_migration from "../migrations/carbon_ledger_migration.js";
import type * as migrations_eco_mode_migration from "../migrations/eco_mode_migration.js";
import type * as migrations_highlighted_papers_migration from "../migrations/highlighted_papers_migration.js";
import type * as openrouter from "../openrouter.js";
import type * as paperNotifications from "../paperNotifications.js";
import type * as papers from "../papers.js";
import type * as papersQueue from "../papersQueue.js";
import type * as resend from "../resend.js";
import type * as sitemap from "../sitemap.js";
import type * as slopId from "../slopId.js";
import type * as slopbotDailyHighlight from "../slopbotDailyHighlight.js";
import type * as slopbotPrompts from "../slopbotPrompts.js";
import type * as slopbotPublishedTweet from "../slopbotPublishedTweet.js";
import type * as slopbotTweets from "../slopbotTweets.js";
import type * as slopbotWebhook from "../slopbotWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  carbonLedger: typeof carbonLedger;
  crons: typeof crons;
  editorsComments: typeof editorsComments;
  environmentalImpact: typeof environmentalImpact;
  http: typeof http;
  "migrations/carbon_ledger_migration": typeof migrations_carbon_ledger_migration;
  "migrations/eco_mode_migration": typeof migrations_eco_mode_migration;
  "migrations/highlighted_papers_migration": typeof migrations_highlighted_papers_migration;
  openrouter: typeof openrouter;
  paperNotifications: typeof paperNotifications;
  papers: typeof papers;
  papersQueue: typeof papersQueue;
  resend: typeof resend;
  sitemap: typeof sitemap;
  slopId: typeof slopId;
  slopbotDailyHighlight: typeof slopbotDailyHighlight;
  slopbotPrompts: typeof slopbotPrompts;
  slopbotPublishedTweet: typeof slopbotPublishedTweet;
  slopbotTweets: typeof slopbotTweets;
  slopbotWebhook: typeof slopbotWebhook;
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

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
