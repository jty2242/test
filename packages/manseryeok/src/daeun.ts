/**
 * 대운(大運) — 10년 단위의 흐름. 월주에서 출발해 순행 또는 역행한다.
 *
 * 방향은 성별과 년간의 음양으로 갈린다. 이것 때문에 판코드에 성별이 들어간다.
 * 같은 8글자라도 성별이 다르면 대운이 정반대로 흐른다.
 *
 *   양년 남자 · 음년 여자  →  순행 (월주에서 앞으로)
 *   음년 남자 · 양년 여자  →  역행 (월주에서 뒤로)
 *
 * 시작 나이(대운수)는 출생에서 절(節)까지의 거리로 정한다.
 *
 *   순행: 다음 절까지 남은 일수 ÷ 3
 *   역행: 지난 절부터 흐른 일수 ÷ 3
 *
 * 3일 = 1년. 하루 = 4개월. 관행상 소수점은 반올림한다.
 *
 *   출생 ─────┬──── 다음 절
 *        지난 절
 *        │◀── 역행이 재는 거리
 *             │◀── 순행이 재는 거리 ──▶│
 */

import type { GanjiIndex, Gender } from './types.ts';
import { solarTermsInYear, type SolarTerm } from './solar-terms.ts';
import {
  isYangYear,
  precedingMonthTerm,
  type Moment,
} from './year-month-pillar.ts';

/** 3일이 1년에 대응한다. */
const DAYS_PER_LUCK_YEAR = 3;

export type LuckDirection = 'forward' | 'reverse';

export interface LuckPillar {
  /** 몇 번째 대운인가 (1부터) */
  ordinal: number;
  ganji: GanjiIndex;
  /** 이 대운이 시작되는 나이 (세는 나이 아님, 만 나이 기준 근사) */
  startAge: number;
}

export interface Daeun {
  direction: LuckDirection;
  /** 첫 대운이 시작되는 나이. 대운수(大運數). */
  startAge: number;
  /** 절까지의 거리 (일). 대운수 산출 근거를 보여줄 때 쓴다. */
  daysToTerm: number;
  pillars: LuckPillar[];
}

function minutesOf(t: { year: number; month: number; day: number; hour: number; minute: number }): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) / 60000;
}

/** 대운 방향. 양년남·음년여는 순행, 나머지는 역행. */
export function luckDirection(yearGanji: GanjiIndex, gender: Gender): LuckDirection {
  const yang = isYangYear(yearGanji);
  const male = gender === 'male';
  return yang === male ? 'forward' : 'reverse';
}

/** 이 순간 이후 처음 오는 절(節). */
function followingMonthTerm(m: Moment): SolarTerm {
  const target = minutesOf(m);
  const candidates = [
    ...solarTermsInYear(m.year),
    ...solarTermsInYear(m.year + 1),
  ]
    .filter((t) => t.isMonthBoundary)
    .sort((a, b) => minutesOf(a) - minutesOf(b));

  const next = candidates.find((t) => minutesOf(t) > target);
  if (!next) throw new Error(`다음 절기를 찾지 못했습니다: ${JSON.stringify(m)}`);
  return next;
}

/**
 * 대운. 기본 8주(80년)까지 낸다.
 *
 * @param moment    KST 벽시계 출생 시각. 시각을 모르면 정오로 넣는다 —
 *                  대운수가 하루의 일부만큼 달라지지만 3일=1년이라 영향이 작다.
 * @param yearGanji 년주 (입춘 기준)
 * @param monthGanji 월주
 */
export function daeun(
  moment: Moment,
  yearGanji: GanjiIndex,
  monthGanji: GanjiIndex,
  gender: Gender,
  count = 8,
): Daeun {
  const direction = luckDirection(yearGanji, gender);

  const boundary =
    direction === 'forward' ? followingMonthTerm(moment) : precedingMonthTerm(moment);

  const days = Math.abs(minutesOf(boundary) - minutesOf(moment)) / 1440;
  const startAge = Math.max(1, Math.round(days / DAYS_PER_LUCK_YEAR));

  const step = direction === 'forward' ? 1 : -1;
  const pillars: LuckPillar[] = [];
  for (let i = 0; i < count; i++) {
    pillars.push({
      ordinal: i + 1,
      ganji: (((monthGanji + step * (i + 1)) % 60) + 60) % 60,
      startAge: startAge + i * 10,
    });
  }

  return {
    direction,
    startAge,
    daysToTerm: Math.round(days * 100) / 100,
    pillars,
  };
}
