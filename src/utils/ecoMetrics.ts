const formatNumber = (value: number, maximumFractionDigits = 1) =>
  value.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

export const tokensToEnergyMWh = (tokens: number, energyPerTokenWh: number) => tokens * energyPerTokenWh * 1000;
export const tokensToCo2g = (tokens: number, energyPerTokenWh: number, co2PerWh: number) =>
  tokens * energyPerTokenWh * co2PerWh;

export const formatEnergy = (mWh: number) => `${formatNumber(mWh)} mWh`;
export const formatCo2 = (grams: number) => `${formatNumber(grams)} g CO₂`;
export const formatTokens = (tokens: number) => tokens.toLocaleString("en-GB");
export const formatCurrency = (amount: number, digits = 4) => `$${amount.toFixed(digits)}`;
