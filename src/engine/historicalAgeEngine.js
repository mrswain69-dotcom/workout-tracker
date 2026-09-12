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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function birthdayYmdForYear(birth, year) {
  if (!birth) return "";
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    // Keep Stage 1's deterministic rule: a 29-Feb birthday advances age on
    // 1 March in non-leap years rather than silently inventing 29 February.
    return `${year}-03-01`;
  }
  return `${year}-${pad2(birth.month)}-${pad2(birth.day)}`;
}

function previousYmd(value) {
  const parsed = parseYmd(value);
  if (!parsed) return "";
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
  const thisYearBirthday = birthdayYmdForYear(birth, event.year);
  if (event.text < thisYearBirthday) age -= 1;

  return age >= 0 ? age : null;
}

export function ageChapterDateRange(birthDate, age) {
  const birth = parseYmd(birthDate);
  const numericAge = Number(age);
  if (!birth || !Number.isInteger(numericAge) || numericAge < 0) return null;

  const startYear = birth.year + numericAge;
  const endYear = startYear + 1;
  const startDate = birthdayYmdForYear(birth, startYear);
  const nextBirthday = birthdayYmdForYear(birth, endYear);
  return {
    age: numericAge,
    startDate,
    endDate: previousYmd(nextBirthday),
  };
}

export function historicalAgeChapter(birthDate, eventDate) {
  const age = calculateAgeOnDate(birthDate, eventDate);
  return age === null
    ? { age: null, label: "Age timeline unavailable", available: false }
    : {
        age,
        label: `Age ${age}`,
        available: true,
        ...ageChapterDateRange(birthDate, age),
      };
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
