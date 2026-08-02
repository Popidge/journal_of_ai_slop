const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export const isPipelineSmokeTestMode = (): boolean => {
  const value = process.env.PIPELINE_SMOKE_TEST_MODE?.trim().toLowerCase();
  const deployment = process.env.CONVEX_DEPLOYMENT?.trim().toLowerCase();
  return (
    value !== undefined &&
    ENABLED_VALUES.has(value) &&
    deployment?.startsWith("dev:") === true
  );
};

export const logPipelineSmokeTest = (
  integration: string,
  detail: Record<string, unknown> = {},
): void => {
  console.info(`[pipeline-smoke-test] ${integration}`, detail);
};
