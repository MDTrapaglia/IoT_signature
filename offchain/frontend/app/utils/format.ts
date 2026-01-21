export type DateInput = Date | string | number;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

// Force consistent English formatting regardless of browser locale
export const formatDateTime = (
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string
): string => {
  const formatOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'short',
    timeStyle: 'short',
    ...options
  };

  if (timeZone) {
    formatOptions.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat('en-US', formatOptions).format(toDate(value));
};

export const formatTime = (value: DateInput, timeZone?: string): string => {
  const formatOptions: Intl.DateTimeFormatOptions = { timeStyle: 'short' };

  if (timeZone) {
    formatOptions.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat('en-US', formatOptions).format(toDate(value));
};
