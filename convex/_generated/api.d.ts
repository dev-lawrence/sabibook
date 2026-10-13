/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as customers from "../customers.js";
import type * as entries from "../entries.js";
import type * as http from "../http.js";
import type * as model_asr from "../model/asr.js";
import type * as model_demo from "../model/demo.js";
import type * as model_extraction from "../model/extraction.js";
import type * as model_languages from "../model/languages.js";
import type * as model_ledger from "../model/ledger.js";
import type * as model_llm from "../model/llm.js";
import type * as model_numbers from "../model/numbers.js";
import type * as model_phone from "../model/phone.js";
import type * as model_reminders from "../model/reminders.js";
import type * as model_voiceNotes from "../model/voiceNotes.js";
import type * as pipeline from "../pipeline.js";
import type * as pipelineStore from "../pipelineStore.js";
import type * as profile from "../profile.js";
import type * as receipts from "../receipts.js";
import type * as reminders from "../reminders.js";
import type * as totals from "../totals.js";
import type * as voiceNotes from "../voiceNotes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  customers: typeof customers;
  entries: typeof entries;
  http: typeof http;
  "model/asr": typeof model_asr;
  "model/demo": typeof model_demo;
  "model/extraction": typeof model_extraction;
  "model/languages": typeof model_languages;
  "model/ledger": typeof model_ledger;
  "model/llm": typeof model_llm;
  "model/numbers": typeof model_numbers;
  "model/phone": typeof model_phone;
  "model/reminders": typeof model_reminders;
  "model/voiceNotes": typeof model_voiceNotes;
  pipeline: typeof pipeline;
  pipelineStore: typeof pipelineStore;
  profile: typeof profile;
  receipts: typeof receipts;
  reminders: typeof reminders;
  totals: typeof totals;
  voiceNotes: typeof voiceNotes;
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
