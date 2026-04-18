type DayType = 'weekday' | 'rest' | 'public_holiday'

const MULTIPLIER: Record<DayType, number> = {
  weekday: 1.5,
  rest: 2.0,
  public_holiday: 3.0,
}

export function calcOtAmount(
  baseSalary: number,
  shiftHours: number,
  workingDaysPerMonth: number,
  otHours: number,
  dayType: DayType
): number {
  const hourlyRate = baseSalary / (workingDaysPerMonth * shiftHours)
  return parseFloat((hourlyRate * otHours * MULTIPLIER[dayType]).toFixed(2))
}
