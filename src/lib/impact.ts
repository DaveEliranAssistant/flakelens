export type CostEstimate = {
  flakyFailures: number;
  minutesPerInvestigation: number;
  hourlyRate: number;
  hours: number;
  cost: number;
};

/** Each failed attempt on a flaky test is one investigation. Regressions are not included. */
export function estimateFlakeCost(
  flakyFailures: number,
  minutesPerInvestigation: number,
  hourlyRate: number,
): CostEstimate {
  const failures = Number.isFinite(flakyFailures) ? Math.max(0, flakyFailures) : 0;
  const minutes = Number.isFinite(minutesPerInvestigation) ? Math.max(0, minutesPerInvestigation) : 0;
  const rate = Number.isFinite(hourlyRate) ? Math.max(0, hourlyRate) : 0;
  const hours = (failures * minutes) / 60;
  return {
    flakyFailures: failures,
    minutesPerInvestigation: minutes,
    hourlyRate: rate,
    hours,
    cost: hours * rate,
  };
}
