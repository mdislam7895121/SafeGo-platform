/**
 * Shared date utilities for SafeGo platform
 */

/**
 * Calculate age from a date of birth string
 * @param dateOfBirth - Date string in ISO format (YYYY-MM-DD) or any parseable date format
 * @returns Age in years
 */
export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate if a person meets minimum age requirement
 * @param dateOfBirth - Date string in ISO format
 * @param minAge - Minimum required age
 * @returns true if person is at least minAge years old
 */
export function meetsMinimumAge(dateOfBirth: string, minAge: number): boolean {
  if (!dateOfBirth) return false;
  const age = calculateAge(dateOfBirth);
  return age >= minAge;
}

/**
 * Get age requirement for driver type
 * @param driverType - 'ride' or 'delivery'
 * @returns Minimum age requirement
 */
export function getDriverAgeRequirement(driverType: 'ride' | 'delivery'): number {
  return driverType === 'ride' ? 21 : 18;
}
