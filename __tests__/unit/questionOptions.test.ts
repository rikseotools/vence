/**
 * Tests for lib/question-options.ts utility
 */

import {
  OPTION_LETTERS,
  OPTION_LETTERS_LOWER,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_OPTION_INDEX,
  buildOptionsArray,
  getLetters,
  indexToLetter,
  letterToIndex,
} from '@/lib/question-options'

describe('question-options constants', () => {
  test('OPTION_LETTERS has 5 entries A-E', () => {
    expect(OPTION_LETTERS).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  test('OPTION_LETTERS_LOWER has 5 entries a-e', () => {
    expect(OPTION_LETTERS_LOWER).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('MIN_OPTIONS is 2, MAX_OPTIONS is 5, MAX_OPTION_INDEX is 4', () => {
    expect(MIN_OPTIONS).toBe(2)
    expect(MAX_OPTIONS).toBe(5)
    expect(MAX_OPTION_INDEX).toBe(4)
  })
})

describe('buildOptionsArray', () => {
  test('3 options (d=null, e=null)', () => {
    expect(buildOptionsArray('A', 'B', 'C', null, null)).toEqual(['A', 'B', 'C'])
  })

  test('3 options (d=undefined, e=undefined)', () => {
    expect(buildOptionsArray('A', 'B', 'C', undefined, undefined)).toEqual(['A', 'B', 'C'])
  })

  test('3 options (d=empty string, e=null)', () => {
    expect(buildOptionsArray('A', 'B', 'C', '', null)).toEqual(['A', 'B', 'C'])
  })

  test('4 options (standard)', () => {
    expect(buildOptionsArray('A', 'B', 'C', 'D', null)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('4 options (e=undefined)', () => {
    expect(buildOptionsArray('A', 'B', 'C', 'D', undefined)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('5 options', () => {
    expect(buildOptionsArray('A', 'B', 'C', 'D', 'E')).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  test('always includes a, b, c even if empty strings', () => {
    // a/b/c are NOT NULL in DB, but testing edge case
    const result = buildOptionsArray('', '', '', null, null)
    expect(result).toEqual(['', '', ''])
    expect(result.length).toBe(3)
  })

  test('does not include d if empty string', () => {
    expect(buildOptionsArray('A', 'B', 'C', '', 'E')).toEqual(['A', 'B', 'C', 'E'])
  })

  test('preserves order: A, B, C, D, E', () => {
    const result = buildOptionsArray('first', 'second', 'third', 'fourth', 'fifth')
    expect(result[0]).toBe('first')
    expect(result[4]).toBe('fifth')
  })
})

describe('getLetters', () => {
  test('getLetters(3) returns A, B, C', () => {
    expect(getLetters(3)).toEqual(['A', 'B', 'C'])
  })

  test('getLetters(4) returns A, B, C, D', () => {
    expect(getLetters(4)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('getLetters(5) returns A, B, C, D, E', () => {
    expect(getLetters(5)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  test('getLetters(2) returns A, B', () => {
    expect(getLetters(2)).toEqual(['A', 'B'])
  })

  test('getLetters(0) returns empty array', () => {
    expect(getLetters(0)).toEqual([])
  })

  test('getLetters(10) caps at 5', () => {
    expect(getLetters(10)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

describe('indexToLetter', () => {
  test('0 → A', () => expect(indexToLetter(0)).toBe('A'))
  test('1 → B', () => expect(indexToLetter(1)).toBe('B'))
  test('2 → C', () => expect(indexToLetter(2)).toBe('C'))
  test('3 → D', () => expect(indexToLetter(3)).toBe('D'))
  test('4 → E', () => expect(indexToLetter(4)).toBe('E'))
  test('5 → ?', () => expect(indexToLetter(5)).toBe('?'))
  test('-1 → ?', () => expect(indexToLetter(-1)).toBe('?'))
})

describe('letterToIndex', () => {
  test('a → 0 (lowercase)', () => expect(letterToIndex('a')).toBe(0))
  test('A → 0 (uppercase)', () => expect(letterToIndex('A')).toBe(0))
  test('b → 1', () => expect(letterToIndex('b')).toBe(1))
  test('c → 2', () => expect(letterToIndex('c')).toBe(2))
  test('d → 3', () => expect(letterToIndex('d')).toBe(3))
  test('e → 4', () => expect(letterToIndex('e')).toBe(4))
  test('E → 4', () => expect(letterToIndex('E')).toBe(4))
  test('f → -1 (out of range)', () => expect(letterToIndex('f')).toBe(-1))
  test('z → -1', () => expect(letterToIndex('z')).toBe(-1))
  test('empty string → -1', () => expect(letterToIndex('')).toBe(-1))
})
