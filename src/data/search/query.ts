/**
 * Reads what is typed in the search: a period in everyday French or English
 * ("2019", "juillet 2024", "14 juillet", "été 2023", "2019 à 2021", "July 14",
 * "summer 2023", "2019 to 2021"…), whatever the interface's language, and the
 * other words, which are matched against album and place names. Accents and
 * case never matter. Labels and links speak the interface's language. Capture
 * dates are wall-clock times in UTC milliseconds (src/data/model.ts), so
 * periods are built with Date.UTC too.
 */

import { language, localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    range: (from: number, to: number) => `De ${from} à ${to}`,
    rangeQuery: (from: number, to: number) => `${from} a ${to}`,
    everyYear: (period: string) => `${period}, chaque année`,
    monthNames: [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ],
    /** "1er mai", "14 juillet 2024". */
    dayMonth: (day: number, month: string, year: string) =>
      `${day === 1 ? '1er' : day} ${month}${year ? ` ${year}` : ''}`,
    monthYear: (month: string, year: string) => `${month}${year ? ` ${year}` : ''}`,
    seasons: { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' },
    seasonQueries: { spring: 'printemps', summer: 'ete', autumn: 'automne', winter: 'hiver' },
  },
  en: {
    range: (from: number, to: number) => `${from} to ${to}`,
    rangeQuery: (from: number, to: number) => `${from} to ${to}`,
    everyYear: (period: string) => `${period}, every year`,
    monthNames: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    /** "14 July", "14 July 2024". */
    dayMonth: (day: number, month: string, year: string) =>
      `${day} ${month}${year ? ` ${year}` : ''}`,
    monthYear: (month: string, year: string) => `${month}${year ? ` ${year}` : ''}`,
    seasons: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
    seasonQueries: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
  },
});

/** A period: dated items within [from, to), in the given months, on the given day. */
export interface DateFilter {
  /** "Juillet 2024", "Été, chaque année". */
  label: string;
  /** Text that reads back as this period ("ete 2023"), to put in a link. */
  query: string;
  from: number | null;
  to: number | null;
  /** Months 0–11 (January = 0), for a period of every year. */
  months: readonly number[] | null;
  /** Day of the month, for "14 juillet". */
  day: number | null;
}

export interface ParsedQuery {
  /** Every word typed, without the little ones ("de", "à"…): matched against names as typed. */
  words: string[];
  /** The words that are not part of the period. */
  terms: string[];
  /** The first period typed, if any. */
  date: DateFilter | null;
}

/** Lower case, no accents, "œ" as "oe": "Été à Pâques" → "ete a paques". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

/** The words of a name, for prefix matching: "2024-05 - Vacances à Nice" → 2024, 05, vacances, a, nice. */
export function nameWords(name: string): string[] {
  return normalize(name).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Words that say nothing on their own. */
const LITTLE_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'chez',
  'd',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'pour',
  'sur',
  'photo',
  'photos',
  // English
  'and',
  'at',
  'from',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

/** Month names as typed, in French and English; the one of the interface goes in links. */
const MONTHS: readonly { fr: string; en: string; also: readonly string[] }[] = [
  { fr: 'janvier', en: 'january', also: ['janv', 'jan'] },
  { fr: 'fevrier', en: 'february', also: ['fevr', 'fev', 'feb'] },
  { fr: 'mars', en: 'march', also: ['mar'] },
  { fr: 'avril', en: 'april', also: ['avr', 'apr'] },
  { fr: 'mai', en: 'may', also: [] },
  { fr: 'juin', en: 'june', also: ['jun'] },
  { fr: 'juillet', en: 'july', also: ['juil', 'jul'] },
  { fr: 'aout', en: 'august', also: ['aug'] },
  { fr: 'septembre', en: 'september', also: ['sept', 'sep'] },
  { fr: 'octobre', en: 'october', also: ['oct'] },
  { fr: 'novembre', en: 'november', also: ['nov'] },
  { fr: 'decembre', en: 'december', also: ['dec'] },
];

type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** Whole months: spring is March to May, winter December to February. */
const SEASONS: Record<Season, { words: readonly string[]; firstMonth: number }> = {
  spring: { words: ['printemps', 'spring'], firstMonth: 2 },
  summer: { words: ['ete', 'summer'], firstMonth: 5 },
  autumn: { words: ['automne', 'autumn', 'fall'], firstMonth: 8 },
  winter: { words: ['hiver', 'winter'], firstMonth: 11 },
};
const SEASON_KEYS = Object.keys(SEASONS) as Season[];

const monthOf = (word: string) =>
  MONTHS.findIndex((names) => names.fr === word || names.en === word || names.also.includes(word));
const seasonOf = (word: string) => SEASON_KEYS.find((key) => SEASONS[key].words.includes(word));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Tokens of the query: "2019-2021" and "2024-05-12" stay whole, the rest splits into words. */
function tokens(text: string): string[] {
  return (
    normalize(text).match(/\d{4}-\d{4}(?!\d)|\d{4}(?:-\d{1,2}){1,2}(?!\d)|[\p{L}\p{N}]+/gu) ?? []
  );
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The period that starts at tokens[at], with the number of tokens it takes;
 * null when there is none there. Years run from 2000 to next year, as
 * capture dates do (src/data/dates.ts).
 */
function periodAt(
  list: readonly string[],
  at: number,
  maxYear: number,
): { date: DateFilter; length: number } | null {
  const word = list[at] ?? '';
  const year = (text: string | undefined) => {
    if (text === undefined || !/^\d{4}$/.test(text)) return null;
    const value = Number(text);
    return value >= 2000 && value <= maxYear ? value : null;
  };
  const yearRange = (from: number, to: number, length: number) => ({
    date:
      from === to
        ? {
            label: String(from),
            query: String(from),
            from: Date.UTC(from, 0, 1),
            to: Date.UTC(from + 1, 0, 1),
            months: null,
            day: null,
          }
        : {
            label: t.range(from, to),
            query: t.rangeQuery(from, to),
            from: Date.UTC(from, 0, 1),
            to: Date.UTC(to + 1, 0, 1),
            months: null,
            day: null,
          },
    length,
  });
  const monthPeriod = (
    month: number,
    inYear: number | null,
    day: number | null,
    length: number,
  ) => {
    const name = t.monthNames[month] ?? '';
    const queryName = MONTHS[month]?.[language] ?? '';
    if (day !== null && day > (inYear === null ? daysIn(2000, month) : daysIn(inYear, month))) {
      return null; // 31 février
    }
    const prefix = day === null ? '' : `${day} `;
    const label = (inYearText: string) =>
      capitalize(day === null ? t.monthYear(name, inYearText) : t.dayMonth(day, name, inYearText));
    if (inYear === null) {
      return {
        date: {
          label: t.everyYear(label('')),
          query: `${prefix}${queryName}`,
          from: null,
          to: null,
          months: [month],
          day,
        },
        length,
      };
    }
    return {
      date: {
        label: label(String(inYear)),
        query: `${prefix}${queryName} ${inYear}`,
        from: Date.UTC(inYear, month, day ?? 1),
        to: day === null ? Date.UTC(inYear, month + 1, 1) : Date.UTC(inYear, month, day + 1),
        months: null,
        day: null,
      },
      length,
    };
  };

  // 2019-2021
  const range = /^(\d{4})-(\d{4})$/.exec(word);
  if (range) {
    const from = year(range[1]);
    const to = year(range[2]);
    return from !== null && to !== null && from <= to ? yearRange(from, to, 1) : null;
  }
  // 2024-05, 2024-05-12
  const numeric = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(word);
  if (numeric) {
    const inYear = year(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const day = numeric[3] === undefined ? null : Number(numeric[3]);
    if (inYear === null || month < 0 || month > 11 || day === 0) return null;
    return monthPeriod(month, inYear, day, 1);
  }
  // 2019, 2019 à 2021, 2019 to 2021, 2019 2021
  const first = year(word);
  if (first !== null) {
    const next = list[at + 1];
    const connector = next === 'a' || next === 'au' || next === 'to' ? 1 : 0;
    const second = year(list[at + 1 + connector]);
    if (second !== null && second > first) return yearRange(first, second, 2 + connector);
    return yearRange(first, first, 1);
  }
  // été, été 2023, summer 2023
  const seasonKey = seasonOf(word);
  if (seasonKey) {
    const season = SEASONS[seasonKey];
    const seasonLabel = t.seasons[seasonKey];
    const seasonQuery = t.seasonQueries[seasonKey];
    const months = [0, 1, 2].map((i) => (season.firstMonth + i) % 12);
    const inYear = year(list[at + 1]);
    if (inYear === null) {
      return {
        date: {
          label: t.everyYear(seasonLabel),
          query: seasonQuery,
          from: null,
          to: null,
          months,
          day: null,
        },
        length: 1,
      };
    }
    // Winter 2023 runs from December 2023 to February 2024.
    return {
      date: {
        label:
          seasonKey === 'winter'
            ? `${seasonLabel} ${inYear}-${inYear + 1}`
            : `${seasonLabel} ${inYear}`,
        query: `${seasonQuery} ${inYear}`,
        from: Date.UTC(inYear, season.firstMonth, 1),
        to: Date.UTC(inYear, season.firstMonth + 3, 1),
        months: null,
        day: null,
      },
      length: 2,
    };
  }
  // 14 juillet, 1er mai 2024, 14th July
  const dayMatch = /^(\d{1,2})(?:er|st|nd|rd|th)?$/.exec(word);
  if (dayMatch) {
    const month = monthOf(list[at + 1] ?? '');
    const day = Number(dayMatch[1]);
    if (month < 0 || day < 1) return null;
    const inYear = year(list[at + 2]);
    return monthPeriod(month, inYear, day, inYear === null ? 2 : 3);
  }
  // juillet, juillet 2024, July 14, July 14th 2024
  const month = monthOf(word);
  if (month >= 0) {
    const after = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(list[at + 1] ?? '');
    const day = after ? Number(after[1]) : null;
    if (day !== null && day >= 1 && day <= 31) {
      const inYear = year(list[at + 2]);
      return monthPeriod(month, inYear, day, inYear === null ? 2 : 3);
    }
    const inYear = year(list[at + 1]);
    return monthPeriod(month, inYear, null, inYear === null ? 1 : 2);
  }
  return null;
}

/** Reads a search; `now` bounds the years (no capture date after next year). */
export function parseQuery(text: string, now: number = Date.now()): ParsedQuery {
  const list = tokens(text);
  const maxYear = new Date(now).getUTCFullYear() + 1;
  const words: string[] = [];
  const terms: string[] = [];
  let date: DateFilter | null = null;
  for (let at = 0; at < list.length;) {
    const found = periodAt(list, at, maxYear);
    if (found && !date) {
      date = found.date;
      for (const token of list.slice(at, at + found.length)) words.push(...nameWords(token));
      at += found.length;
      continue;
    }
    const token = list[at] ?? '';
    at += 1;
    for (const word of nameWords(token)) {
      if (LITTLE_WORDS.has(word)) continue;
      words.push(word);
      terms.push(word);
    }
  }
  return { words: words.filter((word) => !LITTLE_WORDS.has(word)), terms, date };
}

/** Whether a capture date falls within the period (undated items never do). */
export function inPeriod(takenAt: number | null, date: DateFilter): boolean {
  if (takenAt === null) return false;
  if (date.from !== null && takenAt < date.from) return false;
  if (date.to !== null && takenAt >= date.to) return false;
  if (date.months || date.day !== null) {
    const day = new Date(takenAt);
    if (date.months && !date.months.includes(day.getUTCMonth())) return false;
    if (date.day !== null && day.getUTCDate() !== date.day) return false;
  }
  return true;
}

/** Every term starts one of the words: "vac nic" fits "Vacances à Nice". */
export function fitsWords(terms: readonly string[], words: readonly string[]): boolean {
  return terms.every((term) => words.some((word) => word.startsWith(term)));
}
