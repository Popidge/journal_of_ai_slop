export const PUBLIC_PIPELINE_FAILURE_REASON =
  "pipeline_processing_failed" as const;

export const toPublicPipelineFailureReason = (
  failureReason: string | undefined,
): typeof PUBLIC_PIPELINE_FAILURE_REASON | undefined =>
  failureReason ? PUBLIC_PIPELINE_FAILURE_REASON : undefined;
