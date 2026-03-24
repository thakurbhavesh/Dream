const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const extractOtpAttemptMeta = (payload = {}) => {
  const source = payload?.errors && typeof payload.errors === "object" ? payload.errors : payload;
  const attemptNumber = toNumberOrNull(source?.attempt_number);
  const maxAttempts = toNumberOrNull(source?.max_attempts);
  const attemptsLeft = toNumberOrNull(source?.attempts_left);

  if (attemptNumber === null && maxAttempts === null && attemptsLeft === null) {
    return null;
  }

  return {
    attemptNumber,
    maxAttempts,
    attemptsLeft,
  };
};

export const getOtpAttemptText = (meta) => {
  if (!meta) return "";
  const parts = [];
  if (meta.attemptNumber !== null && meta.maxAttempts !== null) {
    parts.push(`Attempt ${meta.attemptNumber}/${meta.maxAttempts}`);
  }
  if (meta.attemptsLeft !== null) {
    parts.push(`${meta.attemptsLeft} attempts left`);
  }
  return parts.join(". ");
};

