import { describe, expect, it } from 'vitest';
import { fitsWords, inPeriod, nameWords, normalize, parseQuery } from './query.ts';

const NOW = Date.UTC(2026, 9, 28, 12);
const parse = (text: string) => parseQuery(text, NOW);
const at = (year: number, month: number, day = 1, hour = 12) => Date.UTC(year, month, day, hour);

describe('normalize and nameWords', () => {
  it('ignores accents, case and ligatures', () => {
    expect(normalize('Été à PÂQUES, cœur')).toBe('ete a paques, coeur');
  });

  it('splits names into words, dates and apostrophes included', () => {
    expect(nameWords('2023-07-14 - Feu d’artifice')).toEqual([
      '2023',
      '07',
      '14',
      'feu',
      'd',
      'artifice',
    ]);
    expect(nameWords('Saint-Jean-de-Luz')).toEqual(['saint', 'jean', 'de', 'luz']);
  });
});

describe('parseQuery: periods', () => {
  it('reads a year, between 2000 and next year only', () => {
    const { date, terms } = parse('2019');
    expect(date).toMatchObject({ label: '2019', from: at(2019, 0, 1, 0), to: at(2020, 0, 1, 0) });
    expect(terms).toEqual([]);
    expect(parse('2027').date?.label).toBe('2027');
    expect(parse('2028').date).toBeNull();
    expect(parse('1999').date).toBeNull();
    expect(parse('1999').terms).toEqual(['1999']);
  });

  it('reads a month, with or without its year', () => {
    expect(parse('juillet 2024').date).toMatchObject({
      label: 'Juillet 2024',
      from: at(2024, 6, 1, 0),
      to: at(2024, 7, 1, 0),
      months: null,
    });
    expect(parse('Juillet').date).toMatchObject({
      label: 'Juillet, chaque année',
      months: [6],
      from: null,
    });
    expect(parse('aout 2023').date?.label).toBe('Août 2023');
    expect(parse('Août 2023').date?.label).toBe('Août 2023');
    expect(parse('sept 2022').date?.label).toBe('Septembre 2022');
    expect(parse('déc').date?.months).toEqual([11]);
  });

  it('reads a day, with or without its year, and refuses one that does not exist', () => {
    expect(parse('14 juillet 2024').date).toMatchObject({
      label: '14 juillet 2024',
      from: at(2024, 6, 14, 0),
      to: at(2024, 6, 15, 0),
    });
    expect(parse('1er mai').date).toMatchObject({
      label: '1er mai, chaque année',
      months: [4],
      day: 1,
    });
    expect(parse('29 février 2024').date?.label).toBe('29 février 2024');
    // A day that does not exist is a word that fits nothing.
    expect(parse('29 février 2023')).toMatchObject({
      date: { label: 'Février 2023' },
      terms: ['29'],
    });
    expect(parse('31 avril')).toMatchObject({
      date: { label: 'Avril, chaque année' },
      terms: ['31'],
    });
    expect(parse('2024-05-12').date?.label).toBe('12 mai 2024');
    expect(parse('2024-05').date?.label).toBe('Mai 2024');
    expect(parse('2024-13').date).toBeNull();
  });

  it('reads seasons as whole months, winter running into the next year', () => {
    expect(parse('été 2023').date).toMatchObject({
      label: 'Été 2023',
      from: at(2023, 5, 1, 0),
      to: at(2023, 8, 1, 0),
    });
    expect(parse('hiver 2023').date).toMatchObject({
      label: 'Hiver 2023-2024',
      from: at(2023, 11, 1, 0),
      to: at(2024, 2, 1, 0),
    });
    expect(parse('ete').date).toMatchObject({ label: 'Été, chaque année', months: [5, 6, 7] });
    expect(parse('hiver').date?.months).toEqual([11, 0, 1]);
    expect(parse('printemps').date?.months).toEqual([2, 3, 4]);
    expect(parse('automne').date?.months).toEqual([8, 9, 10]);
  });

  it('reads a range of years, however it is written', () => {
    for (const text of [
      '2019-2021',
      '2019 à 2021',
      'de 2019 a 2021',
      '2019 2021',
      '2019 au 2021',
    ]) {
      expect(parse(text).date, text).toMatchObject({
        label: 'De 2019 à 2021',
        from: at(2019, 0, 1, 0),
        to: at(2022, 0, 1, 0),
      });
    }
    // Backwards, the second year is just another word.
    expect(parse('2021 2019').date?.label).toBe('2021');
  });

  it('keeps the other words as terms, without the little ones', () => {
    const query = parse('Photos de Lyon en été 2023');
    expect(query.date?.label).toBe('Été 2023');
    expect(query.terms).toEqual(['lyon']);
    expect(query.words).toEqual(['lyon', 'ete', '2023']);
  });

  it('takes the first period only', () => {
    const query = parse('2019 juillet');
    expect(query.date?.label).toBe('2019');
    expect(query.terms).toEqual(['juillet']);
  });

  it('gives each period a query that reads back as the same period', () => {
    for (const text of [
      '2019',
      'juillet 2024',
      'juillet',
      '14 juillet 2024',
      '1er mai',
      'été 2023',
      'ete',
      'hiver 2023',
      '2019-2021',
      'fevrier 2024',
    ]) {
      const date = parse(text).date;
      expect(date, text).not.toBeNull();
      expect(parse(date?.query ?? '').date, text).toEqual(date);
    }
  });
});

describe('inPeriod', () => {
  it('bounds a period by its dates, months and day, never with undated items', () => {
    const summer = parse('été 2023').date!;
    expect(inPeriod(at(2023, 5, 1, 0), summer)).toBe(true);
    expect(inPeriod(at(2023, 7, 31, 23), summer)).toBe(true);
    expect(inPeriod(at(2023, 8, 1, 0), summer)).toBe(false);
    expect(inPeriod(null, summer)).toBe(false);

    const everyJuly14 = parse('14 juillet').date!;
    expect(inPeriod(at(2019, 6, 14), everyJuly14)).toBe(true);
    expect(inPeriod(at(2019, 6, 15), everyJuly14)).toBe(false);
    expect(inPeriod(at(2019, 5, 14), everyJuly14)).toBe(false);

    const winters = parse('hiver').date!;
    expect(inPeriod(at(2020, 0, 10), winters)).toBe(true);
    expect(inPeriod(at(2020, 11, 31), winters)).toBe(true);
    expect(inPeriod(at(2020, 2, 1), winters)).toBe(false);
  });
});

describe('fitsWords', () => {
  it('wants every term to start one of the words', () => {
    const words = nameWords('2024-07 - Vacances à Nice');
    expect(fitsWords(['vac', 'nic'], words)).toBe(true);
    expect(fitsWords(['vacances', 'lyon'], words)).toBe(false);
    expect(fitsWords(['ances'], words)).toBe(false);
    expect(fitsWords([], words)).toBe(true);
  });
});
