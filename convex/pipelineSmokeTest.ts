const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export const isPipelineSmokeTestMode = (): boolean => {
  const value = process.env.PIPELINE_SMOKE_TEST_MODE?.trim().toLowerCase();
  return value !== undefined && ENABLED_VALUES.has(value);
};

export const logPipelineSmokeTest = (
  integration: string,
  detail: Record<string, unknown> = {},
): void => {
  console.info(`[pipeline-smoke-test] ${integration}`, detail);
};
