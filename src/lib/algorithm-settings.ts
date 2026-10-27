/** Penalties use normalized cost/time regret, 0–100 interest fit and date-bound conditions. */
export const algorithmSettings = {
  weights: { cost: .35, time: .25, experiences: .40, forecastWeather: .22, seasonalWeather: .05, historicalWeather: .10, unknownWeather: .01, event: .025, maxEvents: .08 },
  objectives: { value: { cost: .65, time: .15, experiences: .20 }, fast: { cost: .15, time: .65, experiences: .20 } },
  programme: { slowMinutes: 240, balancedMinutes: 360, activeMinutes: 480, localTransferMinutes: 30, repeatDecay: .6, experienceCost: 100 },
  search: { basePool: 20, beamQuota: 60, alternatives: 3, novelty: .15, maximumRegret: .15, liveTemplates: 6, weatherBases: 20 },
} as const;
