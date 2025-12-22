"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} environment variable must be set to call the n8n webhook`);
  }
  return value;
};

export const triggerN8nPost = internalAction({
  args: {
    postBody: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const webhookUrl = requireEnv("N8N_WEBHOOK_URL");
    const webhookToken = requireEnv("N8N_WEBHOOK_TOKEN");

    const payload = new TextEncoder().encode(args.postBody);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Authorization: webhookToken,
      },
      body: payload,
    });

    if (!response.ok) {
      const message = response.statusText ? ` ${response.statusText}` : "";
      throw new Error(`n8n webhook returned ${response.status}${message}`);
    }

    return null;
  },
});
