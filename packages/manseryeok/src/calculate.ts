/**
 * 엔진 진입점. 생년월일시 + 성별 → 사주판.
 *
 * ⚠️ 시간 기준을 두 가지로 나눠 쓴다. 섞으면 조용히 틀린다.
 *
 *   년주·월주  →  KST 벽시계로 판정
 *       절입 시각은 특정 **물리적 순간**이고 KST로 공표된다. 출생도 물리적
 *       순간이다. 둘을 비교하려면 같은 시간 척도여야 한다. 진태양시로 보정한
 *       값은 그 물리적 순간의 라벨을 32분 옮겨놓은 것이라, KST로 적힌 절입
 *       시각과 비교하면 단위가 다른 것을 비교하는 셈이 된다.
 *
 *   일주·시주  →  진태양시로 판정
 *       시지는 시계가 아니라 하늘에서 태양이 어디 있느냐의 문제다. 자시가
 *       하루를 여는 것도 태양 기준이다. 그래서 여기는 보정된 시각을 쓴다.
 *
 * 이 구분은 구현마다 갈리는 지점이다. 교차검증에서 오라클과 어긋나면
 * 여기부터 의심할 것.
 */

import type { Gender, JasiPolicy, Pan } from './types.ts';
import { encodePanCode } from './pan-code.ts';
import { toTrueSolarTime, type TrueSolarResult } from './true-solar-time.ts';
import { dayAndHourPillars } from './day-hour-pillar.ts';
import { yearPillar, monthPillar, sajuYear, type Moment } from './year-month-pillar.ts';
import { daeun, type Daeun } from './daeun.ts';
import { termBoundaryProximity, type BoundaryProximity } from './solar-terms.ts';

export class InvalidBirthInput extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'InvalidBirthInput';
    this.field = field;
  }
}

export interface BirthInput {
  /** 양력 기준. 음력 입력은 호출 전에 변환해서 넣는다. */
  year: number;
  month: number;
  day: number;
  /** null이면 출생 시각 모름 → 시주 없이 3주 */
  hour: number | null;
  minute?: number;
  gender: Gender;
  /** 출생지 경도(동경 도). 기본 서울. */
  longitude?: number;
}

export interface Chart {
  jasi: JasiPolicy;
  pan: Pan;
  panCode: string;
  daeun: Daeun;
}

export interface SajuResult {
  charts: Chart[];
  /**
   * 23시대 출생이라 유파에 따라 결과가 갈리는가.
   * true면 charts가 2개이고 UI는 둘을 병기해야 한다.
   */
  isJasiAmbiguous: boolean;
  /** 절기 경계에 붙어 있어 년주·월주가 갈릴 수 있는가 */
  termBoundary: BoundaryProximity;
  /** 진태양시 보정 내역. 사용자에게 근거를 보여줄 때 쓴다. */
  trueSolarTime: TrueSolarResult | null;
  /** 입춘 기준 연도. 달력 연도와 다를 수 있다. */
  sajuYear: number;
}

const SUPPORTED_MIN_YEAR = 1900;
const SUPPORTED_MAX_YEAR = 2100;

function validate(input: BirthInput): void {
  const { year, month, day, hour, minute = 0 } = input;

  if (!Number.isInteger(year) || year < SUPPORTED_MIN_YEAR || year > SUPPORTED_MAX_YEAR) {
    throw new InvalidBirthInput(
      'year',
      `${SUPPORTED_MIN_YEAR}~${SUPPORTED_MAX_YEAR}년만 지원합니다 (받은 값: ${year})`,
    );
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new InvalidBirthInput('month', `월이 올바르지 않습니다: ${month}`);
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new InvalidBirthInput('day', `일이 올바르지 않습니다: ${day}`);
  }
  // 2월 30일 같은 존재하지 않는 날짜를 거른다
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new InvalidBirthInput('day', `존재하지 않는 날짜입니다: ${year}-${month}-${day}`);
  }
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
    throw new InvalidBirthInput('hour', `시가 올바르지 않습니다: ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new InvalidBirthInput('minute', `분이 올바르지 않습니다: ${minute}`);
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    throw new InvalidBirthInput('gender', `성별이 올바르지 않습니다: ${input.gender}`);
  }
}

/**
 * 자시 유파에 따라 결과가 갈리는 구간인가.
 *
 * ⚠️ 판정 기준은 **진태양시**다. 벽시계로 보면 안 된다. 서울 기준 보정이
 * 약 -32분이라 벽시계 23:45는 진태양시 23:13(자시)이지만, 서머타임까지
 * 겹치면 22:43(해시)이 되어 유파가 갈릴 여지가 없다. 반대로 벽시계 00:15는
 * 진태양시로 전날 23:43이라 갈린다. 벽시계로 판정하면 양쪽 다 틀린다.
 */
export function isJasiAmbiguousHour(trueSolarHour: number | null): boolean {
  return trueSolarHour !== null && trueSolarHour >= 23;
}

export function calculate(input: BirthInput): SajuResult {
  validate(input);

  const { year, month, day, hour, minute = 0, gender, longitude } = input;

  // 년주·월주는 KST 벽시계로. 시각을 모르면 정오로 잡는다 — 절기 경계에서
  // 하루를 잘못 넘길 확률이 가장 낮은 시각이다.
  const kstMoment: Moment = { year, month, day, hour: hour ?? 12, minute };

  const yearGanji = yearPillar(kstMoment);
  const monthGanji = monthPillar(kstMoment);
  const termBoundary = termBoundaryProximity(year, month, day, hour ?? 12, minute);

  // 일주·시주는 진태양시로.
  let tst: TrueSolarResult | null = null;
  let solarMoment = { year, month, day, hour: null as number | null };

  if (hour !== null) {
    tst = toTrueSolarTime({ year, month, day, hour, minute }, { longitude });
    solarMoment = { year: tst.year, month: tst.month, day: tst.day, hour: tst.hour };
  }

  const policies: JasiPolicy[] = isJasiAmbiguousHour(solarMoment.hour)
    ? ['yaja', 'joja']
    : ['yaja'];

  const charts: Chart[] = policies.map((jasi) => {
    const { day: dayGanji, hour: hourGanji } = dayAndHourPillars(solarMoment, jasi);
    const pan: Pan = {
      year: yearGanji,
      month: monthGanji,
      day: dayGanji,
      hour: hourGanji,
      gender,
      jasi,
    };
    return {
      jasi,
      pan,
      panCode: encodePanCode(pan),
      daeun: daeun(kstMoment, yearGanji, monthGanji, gender),
    };
  });

  return {
    charts,
    isJasiAmbiguous: charts.length > 1,
    termBoundary,
    trueSolarTime: tst,
    sajuYear: sajuYear(kstMoment),
  };
}
