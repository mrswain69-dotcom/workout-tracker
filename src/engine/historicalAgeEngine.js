function parseYmd(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { text, year, month, day };
}

export function isValidHistoricalDate(value) {
  return !!parseYmd(value);
}

export function calculateAgeOnDate(birthDate, eventDate) {
  const birth = parseYmd(birthDate);
  const event = parseYmd(eventDate);
  if (!birth || !event) return null;

  const birthKey = birth.year * 10000 + birth.month * 100 + birth.day;
  const eventKey = event.year * 10000 + event.month * 100 + event.day;
  if (eventKey < birthKey) return null;

  let age = event.year - birth.year;
  if (
    event.month < birth.month ||
    (event.month === birth.month && event.day < birth.day)
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function historicalAgeChapter(birthDate, eventDate) {
  const age = calculateAgeOnDate(birthDate, eventDate);
  return age === null
    ? { age: null, label: "Age timeline unavailable", available: false }
    : { age, label: `Age ${age}`, available: true };
}

export function validateBirthDateForProfile(birthDate, todayYmd) {
  if (birthDate === null || birthDate === undefined || birthDate === "") {
    return { value: null, error: null };
  }

  const birth = parseYmd(birthDate);
  if (!birth) {
    return { value: null, error: new Error("Enter a valid date of birth.") };
  }

  const today = parseYmd(todayYmd);
  if (today) {
    const age = calculateAgeOnDate(birth.text, today.text);
    if (age === null) {
      return { value: null, error: new Error("Date of birth cannot be in the future.") };
    }
  }

  return { value: birth.text, error: null };
}
