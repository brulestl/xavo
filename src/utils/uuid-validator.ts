/**
 * UUID validation utility
 */

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates if a string is a valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_REGEX.test(uuid);
}

/**
 * Validates UUID and throws error if invalid
 */
export function validateUUID(uuid: string, fieldName: string = 'UUID'): void {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID format`);
  }
}

/**
 * Safely validates UUID and returns boolean
 */
export function safeValidateUUID(uuid: string): boolean {
  try {
    return isValidUUID(uuid);
  } catch {
    return false;
  }
} 