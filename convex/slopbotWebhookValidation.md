# Slopbot webhook validation notes

1. Call `recordPostOutcome` with a `postBody` payload (via a backend mutation or Convex Devtools).
   - After the mutation resolves, open the Convex dashboard or Devtools and look for the scheduled action entry tied to `internal.slopbotWebhook.triggerN8nPost`. It should only appear when the mutation succeeded and `postBody` was provided.
2. Confirm the webhook request reached n8n by checking the webhook's activity log – the POST body must match the string that was passed in.
3. To validate failure handling, force an error (missing `N8N_WEBHOOK_URL` or a non-200 response) and verify the action throws. Convex retries these scheduled actions and surfaces the failure in the action log, so check there for retries and error details.
4. If retries exhaust, the Convex dashboard will still show the failure timestamp; use that along with n8n logs to understand why the webhook never succeeded.
