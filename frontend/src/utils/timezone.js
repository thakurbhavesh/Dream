/**
 * User timezone preference store.
 * All time formatting in the app reads from here.
 */

let _timezone = "UTC";

export const setUserTimezone = (tz) => {
  if (!tz) return;
  try {
    // Validate
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    _timezone = tz;
  } catch {
    _timezone = "UTC";
  }
};

export const getUserTimezone = () => _timezone;

/**
 * Format a date/time value in user's timezone.
 * @param {Date|string|number} value
 * @param {Intl.DateTimeFormatOptions} options
 */
export const formatInUserTz = (value, options = {}) => {
  if (!value) return "";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: _timezone,
    }).format(date);
  } catch {
    return "";
  }
};

export const formatTimeInTz = (value) =>
  formatInUserTz(value, { hour: "2-digit", minute: "2-digit" });

export const formatDayInTz = (value) =>
  formatInUserTz(value, { weekday: "short", month: "short", day: "numeric" });

export const formatFullDayInTz = (value) =>
  formatInUserTz(value, { weekday: "long", month: "long", day: "numeric" });

export const formatDateTimeInTz = (value) =>
  formatInUserTz(value, { dateStyle: "medium", timeStyle: "short" });
