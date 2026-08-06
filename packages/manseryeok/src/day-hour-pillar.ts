/**
 * 일주(日柱)와 시주(時柱). 절기 테이블이 필요 없는 부분 — 순수 산술이다.
 * (년주·월주는 절기가 있어야 하므로 아직 없다.)
 *
 * 일주는 사용자가 유일하게 외우고 있는 값이다. "나는 경오일주"는 정체성이라
 * 여기가 틀리면 나머지가 다 맞아도 신뢰를 잃는다.
 *
 *   진태양시 날짜 ──▶ 기준일로부터 경과일수 ──▶ mod 60 ──▶ 일주
 *                                                   │
 *   진태양시 시각 ──▶ 2시간 단위 지지 ──────────────┼──▶ 시주 (오서둔)
 *                                              일간 ┘
 *
 * 자시 처리:
 *   야자시  23:00~23:59 → 지지는 子, 그리고 날짜가 다음날로 넘어간다.
 *                         일주와 시주 모두 다음날 일간을 쓴다.
 *   조자시  23:00~23:59 → 지지는 子지만 날짜는 그대로. 일주는 오늘 것.
 *   00:00~00:59는 두 유파 모두 子시이고 날짜도 그대로다. 차이가 없다.
 */

import type { GanjiIndex, JasiPolicy } from './types.ts';

/**
 * 검증된 앵커 — KASI 1차 자료. (2026-08-06 확정)
 *
 * 일주 계산 전체가 이 상수 하나에 걸려 있다. 하루라도 어긋나면 모든 사용자의
 * 일주가 통째로 밀린다.
 *
 * 한국천문연구원 음양력 API가 양력 1984-02-02를 일진 병인(丙寅), 율리우스적일
 * 2445733으로 반환한다. 丙寅은 60갑자 인덱스 2다.
 *
 *   최초 구현은 이 날짜를 甲子(0)로 잡았고 2칸 틀렸다. 널리 인용되는 값이라고
 *   해서 맞는 건 아니었다. 1900~2026년 음력 1월 1일 127건 전부 델타 +2로
 *   일정했고, 독립 경로인 JDN 공식 (solJd + 49) % 60 과도 127/127 일치했다.
 *
 * 재확인: scripts/verify-day-anchor.ts
 */
export const DAY_ANCHOR = {
  /** 양력 1984-02-02 = 병인(丙寅) = 60갑자 인덱스 2. KASI 음양력 API 확인. */
  year: 1984,
  month: 2,
  day: 2,
  ganji: 2,
  /** 같은 날의 율리우스적일. JDN 경로 교차검증에 쓴다. */
  julianDay: 2445733,
} as const;

const MS_PER_DAY = 86400000;
const ANCHOR_UTC = Date.UTC(DAY_ANCHOR.year, DAY_ANCHOR.month - 1, DAY_ANCHOR.day);

/**
 * 진태양시 기준 날짜의 일주.
 * 입력은 이미 진태양시로 보정된 날짜여야 한다. 벽시계 날짜를 그대로 넣으면
 * 자정 근처 출생자가 하루 어긋난다.
 */
export function dayPillarFromDate(year: number, month: number, day: number): GanjiIndex {
  const target = Date.UTC(year, month - 1, day);
  const days = Math.round((target - ANCHOR_UTC) / MS_PER_DAY);
  // JS의 %는 음수를 음수로 돌려준다. 앵커 이전 날짜를 위해 한 번 더 접는다.
  return (((days + DAY_ANCHOR.ganji) % 60) + 60) % 60;
}

/**
 * 율리우스적일. 일주를 구하는 두 번째 경로 — 경과일수 계산과 독립이라
 * 서로를 검증한다. KASI가 solJd로 같은 값을 주므로 1차 자료로도 확인된다.
 */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** JDN 경로로 구한 일주. dayPillarFromDate와 항상 같아야 한다. */
export function dayPillarFromJdn(year: number, month: number, day: number): GanjiIndex {
  return (julianDayNumber(year, month, day) + 49) % 60;
}

/**
 * 시지 인덱스 (0=子 … 11=亥).
 * 子시는 23:00~00:59로 자정을 걸친다. 나머지는 홀수시 시작 2시간씩.
 */
export function hourBranchIndex(hour: number): number {
  return Math.floor(((hour + 1) % 24) / 2);
}

/**
 * 시간(時干) — 오서둔(五鼠遁). 일간이 정해지면 子시의 천간이 정해지고,
 * 거기서 지지를 따라 순행한다.
 *
 *   일간 甲己 → 子시 甲    일간 乙庚 → 丙    丙辛 → 戊    丁壬 → 庚    戊癸 → 壬
 *
 * 일간 인덱스를 5로 나눈 나머지에 2를 곱하면 그대로 나온다.
 */
export function hourStemIndex(dayGanji: GanjiIndex, branchIndex: number): number {
  const dayStem = dayGanji % 10;
  return ((dayStem % 5) * 2 + branchIndex) % 10;
}

/** 천간·지지 인덱스를 60갑자 인덱스로. 둘이 짝이 안 맞으면 존재하지 않는 조합이다. */
export function toGanji(stemIndex: number, branchIndex: number): GanjiIndex {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) return i;
  }
  throw new Error(`불가능한 간지 조합: 천간 ${stemIndex}, 지지 ${branchIndex}`);
}

export interface DayHourPillars {
  day: GanjiIndex;
  /** 출생 시각을 모르면 null (3주) */
  hour: GanjiIndex | null;
}

export interface TrueSolarMoment {
  year: number;
  month: number;
  day: number;
  /** null이면 출생 시각 모름 → 시주 없이 일주만 */
  hour: number | null;
}

export function dayAndHourPillars(
  moment: TrueSolarMoment,
  jasi: JasiPolicy,
): DayHourPillars {
  const { year, month, day, hour } = moment;

  if (hour === null) {
    // 시각을 모르면 자시 정책이 개입할 여지가 없다. 그날의 일주만.
    return { day: dayPillarFromDate(year, month, day), hour: null };
  }

  // 야자시는 23시대를 다음날로 넘긴다. Date에 맡겨서 월말·윤년을 직접 안 다룬다.
  const advance = jasi === 'yaja' && hour >= 23;
  let y = year;
  let m = month;
  let d = day;
  if (advance) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }

  const dayGanji = dayPillarFromDate(y, m, d);
  const branch = hourBranchIndex(hour);
  const stem = hourStemIndex(dayGanji, branch);

  return { day: dayGanji, hour: toGanji(stem, branch) };
}
