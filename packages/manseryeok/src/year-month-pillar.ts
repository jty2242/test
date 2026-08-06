/**
 * 년주(年柱)와 월주(月柱). 둘 다 절기가 경계다. 달력이 아니다.
 *
 *   년주 경계 — 입춘. 양력 1월 1일도 설날도 아니다. 2월 3일생과 2월 5일생은
 *               같은 해에 태어나도 년주가 다르다.
 *   월주 경계 — 12절(節). 중기(우수·춘분 등)는 월을 가르지 않는다.
 *
 *   입춘 ──寅월── 경칩 ──卯월── 청명 ──辰월── 입하 ──巳월── …
 *   315도        345도        15도         45도
 *
 * 천간은 한 단계 위 기둥에서 파생된다:
 *   월간 ← 년간 (오호둔 五虎遁)
 *   시간 ← 일간 (오서둔 五鼠遁, day-hour-pillar.ts)
 */

import type { GanjiIndex } from './types.ts';
import { toGanji } from './day-hour-pillar.ts';
import {
  solarTermsInYear,
  MONTH_BOUNDARY_TERMS,
  type SolarTerm,
  type SolarTermName,
} from './solar-terms.ts';

/**
 * 1984년은 갑자년(甲子年)이다. KASI 음양력 API의 세차(歲次)가 1984년을
 * "갑자(甲子)"로 반환하는 것으로 확인했다.
 *
 * 일주 앵커와 달리 이건 60년 주기의 연 단위라 하루 어긋날 여지가 없다.
 */
export const YEAR_ANCHOR = { year: 1984, ganji: 0 } as const;

/**
 * 절(節)이 여는 월의 지지. 입춘이 寅월(인덱스 2)을 열고 순서대로 이어진다.
 * 사주의 한 해는 寅월에서 시작한다 — 子월이 아니다.
 */
const TERM_TO_MONTH_BRANCH: ReadonlyMap<SolarTermName, number> = new Map(
  MONTH_BOUNDARY_TERMS.map((name, i) => [name, (2 + i) % 12]),
);

/** 절기 계산은 비싸다(연당 뉴턴법 48회). 같은 해를 반복 조회하므로 캐시한다. */
const termCache = new Map<number, SolarTerm[]>();

function termsOf(year: number): SolarTerm[] {
  let cached = termCache.get(year);
  if (!cached) {
    cached = solarTermsInYear(year);
    termCache.set(year, cached);
  }
  return cached;
}

function minutesOf(t: { year: number; month: number; day: number; hour: number; minute: number }): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) / 60000;
}

/** KST 벽시계 순간 */
export interface Moment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 이 순간 직전에 지나온 절(節). 월주와 년주 경계를 둘 다 여기서 판정한다.
 * 전해 소한(1월)까지 거슬러야 하므로 이웃 해를 함께 훑는다.
 */
export function precedingMonthTerm(m: Moment): SolarTerm {
  const target = minutesOf(m);
  const candidates = [...termsOf(m.year - 1), ...termsOf(m.year), ...termsOf(m.year + 1)]
    .filter((t) => t.isMonthBoundary)
    .sort((a, b) => minutesOf(a) - minutesOf(b));

  let last: SolarTerm | undefined;
  for (const t of candidates) {
    if (minutesOf(t) <= target) last = t;
    else break;
  }
  if (!last) throw new Error(`절기 경계를 찾지 못했습니다: ${JSON.stringify(m)}`);
  return last;
}

/**
 * 사주 기준 연도. 입춘 이전은 전해로 친다.
 * 1월생과 2월 초생이 여기서 갈린다 — 사주에서 가장 흔한 착각 지점이다.
 */
export function sajuYear(m: Moment): number {
  const ipchun = termsOf(m.year).find((t) => t.name === '입춘')!;
  return minutesOf(m) < minutesOf(ipchun) ? m.year - 1 : m.year;
}

/** 년주. 입춘 기준 연도의 60갑자. */
export function yearPillar(m: Moment): GanjiIndex {
  const y = sajuYear(m);
  return (((y - YEAR_ANCHOR.year + YEAR_ANCHOR.ganji) % 60) + 60) % 60;
}

/**
 * 월주. 지지는 절이 정하고, 천간은 년간에서 오호둔으로 파생된다.
 *
 *   년간 甲己 → 寅월 丙    乙庚 → 戊    丙辛 → 庚    丁壬 → 壬    戊癸 → 甲
 *
 * 년간 인덱스를 5로 나눈 나머지에 2를 곱하고 2를 더하면 그대로 나온다.
 */
export function monthPillar(m: Moment): GanjiIndex {
  const term = precedingMonthTerm(m);
  const branch = TERM_TO_MONTH_BRANCH.get(term.name);
  if (branch === undefined) throw new Error(`월 경계 절기가 아닙니다: ${term.name}`);

  const yearStem = yearPillar(m) % 10;
  const inMonthStem = ((yearStem % 5) * 2 + 2) % 10; // 寅월의 천간
  // 寅월(2)에서 이 월까지 몇 칸 갔나
  const monthsFromIn = (branch - 2 + 12) % 12;
  const stem = (inMonthStem + monthsFromIn) % 10;

  return toGanji(stem, branch);
}

/** 년간이 양(陽)인가. 대운의 순행·역행이 여기에 걸린다. */
export function isYangYear(yearGanji: GanjiIndex): boolean {
  return yearGanji % 2 === 0;
}

/** 캐시 비우기. 테스트에서 메모리 사용을 확인할 때만 쓴다. */
export function clearTermCache(): void {
  termCache.clear();
}
