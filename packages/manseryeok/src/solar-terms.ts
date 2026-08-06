/**
 * 24절기 — 태양의 겉보기 황경이 15도의 배수를 지나는 순간.
 *
 * 테이블을 싣지 않는다. KASI 특일정보 API가 2000~2028년만 제공해서 테이블을
 * 만들 수 없었고, 대신 그 696건을 계산 결과의 검증 세트로 쓴다.
 * (packages/manseryeok/data/kasi-solar-terms.json, scripts/verify-solar-terms.ts)
 *
 * 사주에서 쓰는 두 가지가 여기서 나온다:
 *   년주 경계 — 입춘(황경 315도). 양력 1월 1일도, 설날도 아니다.
 *   월주 경계 — 12절(節). 24절기 중 홀수 번째만 월을 가른다.
 *                입춘·경칩·청명·입하·망종·소서·입추·백로·한로·입동·대설·소한
 *                사이사이의 12중기(우수·춘분…)는 월을 가르지 않는다.
 *
 *   황경 315 ──입춘──▶ 寅월 ──345──▶ 卯월 ──15──▶ 辰월 ── …
 */

import {
  apparentSolarLongitude,
  deltaT,
  julianDayUt,
  fromJulianDay,
} from './solar-position.ts';

/** 24절기. 인덱스 = 황경 / 15. 즉 SOLAR_TERMS[21] = 입춘(315도). */
export const SOLAR_TERMS = [
  '춘분', '청명', '곡우', '입하', '소만', '망종',
  '하지', '소서', '대서', '입추', '처서', '백로',
  '추분', '한로', '상강', '입동', '소설', '대설',
  '동지', '소한', '대한', '입춘', '우수', '경칩',
] as const;

export type SolarTermName = (typeof SOLAR_TERMS)[number];

/** 월을 가르는 12절(節). 나머지 12중기(中氣)는 월 경계가 아니다. */
export const MONTH_BOUNDARY_TERMS: readonly SolarTermName[] = [
  '입춘', '경칩', '청명', '입하', '망종', '소서',
  '입추', '백로', '한로', '입동', '대설', '소한',
];

export interface SolarTerm {
  name: SolarTermName;
  /** 태양 황경 (도). 0, 15, 30, … 345 */
  longitude: number;
  /** KST 기준 순간 */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 월을 가르는 절(節)인가 */
  isMonthBoundary: boolean;
}

const KST_OFFSET_DAYS = 9 / 24;

/**
 * 황경 차이를 −180~+180으로 접는다. 0도(춘분) 부근에서 359.9와 0.1이
 * 359.8도 차이로 계산되는 걸 막는다.
 */
function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/**
 * 지정한 황경에 태양이 도달하는 순간을 찾는다 (율리우스적일, TT).
 *
 * 태양 황경은 하루에 약 0.9856도씩 단조 증가하므로 뉴턴법이 두세 번이면
 * 수렴한다. 초기 추정은 평균 운동으로 잡는다.
 */
function solveForLongitude(targetLongitude: number, guessJde: number): number {
  let jde = guessJde;
  for (let i = 0; i < 8; i++) {
    const diff = angleDiff(targetLongitude, apparentSolarLongitude(jde));
    if (Math.abs(diff) < 1e-7) break; // 1e-7도 ≈ 0.009초
    jde += diff / 0.9856473; // 하루당 평균 이동 도수
  }
  return jde;
}

/** TT 기준 율리우스적일 → KST 벽시계 (분 단위 반올림) */
function jdeToKst(jde: number, approxYear: number, approxMonth: number) {
  const jdUt = jde - deltaT(approxYear, approxMonth) / 86400;
  // 분 단위로 먼저 반올림한 뒤 날짜를 뽑는다. 23:59:40이 다음날 00:00으로
  // 넘어가는 경우를 Date 연산 없이 바르게 처리하기 위해서다.
  const kst = jdUt + KST_OFFSET_DAYS;
  const rounded = Math.round(kst * 1440) / 1440;
  const { year, month, day, dayFraction } = fromJulianDay(rounded);
  const minutes = Math.round(dayFraction * 1440);
  return {
    year,
    month,
    day,
    hour: Math.floor(minutes / 60) % 24,
    minute: minutes % 60,
  };
}

/**
 * 한 해의 24절기 전부. 반환 순서는 시간순(소한 → 대한 → 입춘 → …).
 *
 * 절기는 태양 황경 기준이라 양력 연도와 깔끔하게 맞아떨어지지 않는다.
 * 그 해 안에 들어오는 절기만 담아 돌려준다.
 */
export function solarTermsInYear(year: number): SolarTerm[] {
  const found: SolarTerm[] = [];

  // 전년 12월부터 훑어서 연초 절기(소한·대한)를 놓치지 않는다.
  for (let k = 0; k < 24; k++) {
    const longitude = k * 15;
    const name = SOLAR_TERMS[k];

    // 춘분(0도)이 대략 3월 20일. 거기서 황경만큼 앞뒤로 잡는다.
    const approxDayOfYear = 79 + (longitude / 360) * 365.2422;
    for (const yearShift of [-1, 0]) {
      const guessUt = julianDayUt(year + yearShift, 1, 1) + approxDayOfYear;
      const guessJde = guessUt + deltaT(year + yearShift, 1) / 86400;
      const jde = solveForLongitude(longitude, guessJde);
      const kst = jdeToKst(jde, year, Math.max(1, Math.min(12, Math.round(approxDayOfYear / 30.4))));

      if (kst.year !== year) continue;
      if (found.some((t) => t.name === name)) continue;

      found.push({
        name,
        longitude,
        ...kst,
        isMonthBoundary: MONTH_BOUNDARY_TERMS.includes(name),
      });
    }
  }

  found.sort(
    (a, b) =>
      a.month - b.month || a.day - b.day || a.hour - b.hour || a.minute - b.minute,
  );
  return found;
}

/** 특정 절기 하나의 순간. 입춘 경계 판정에 쓴다. */
export function solarTerm(year: number, name: SolarTermName): SolarTerm {
  const term = solarTermsInYear(year).find((t) => t.name === name);
  if (!term) throw new Error(`${year}년에 ${name}을 찾지 못했습니다`);
  return term;
}

/**
 * 절기 시각의 공표 오차 한계 (분).
 *
 * KASI 696건 대조에서 621건이 분 단위까지 일치했고 나머지는 ±1분이었다.
 * 우리 계산 오차는 약 ±30초이고 KASI는 분 단위로 반올림해 공표하므로,
 * 반올림 경계 부근에서 표시가 1분 갈린다.
 *
 * 이 값보다 가까운 출생은 "어느 쪽인지 단정할 수 없다"로 다룬다. 절기 경계
 * ±2분 안에서 년주나 월주를 하나로 단정하면, 그 단정이 틀렸을 때 되돌릴 방법이
 * 없다. 자시를 둘 다 보여주기로 한 것과 같은 문법이다.
 */
export const TERM_ACCURACY_MINUTES = 2;

export interface BoundaryProximity {
  /** 절기 경계에서 TERM_ACCURACY_MINUTES 이내인가 */
  isAmbiguous: boolean;
  /** 가장 가까운 절기 */
  nearest: SolarTerm;
  /** 가장 가까운 절기까지의 분. 음수면 절기 이전(아직 안 지남). */
  minutesFromTerm: number;
}

function toMinutes(y: number, mo: number, d: number, h: number, mi: number): number {
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

/**
 * 이 순간이 절기 경계에 붙어 있는지. 붙어 있으면 UI가 두 판을 병기해야 한다.
 *
 * 입력은 진태양시가 아니라 **KST 벽시계**다. 절기 시각 자체가 KST로 공표되고
 * 절입 판정은 표준시로 하는 게 관행이다. 진태양시를 쓰면 경계가 32분 밀린다.
 */
export function termBoundaryProximity(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): BoundaryProximity {
  // 1월 초·12월 말 출생이 이웃 해의 절기에 더 가까울 수 있다.
  const candidates = [
    ...solarTermsInYear(year - 1),
    ...solarTermsInYear(year),
    ...solarTermsInYear(year + 1),
  ];

  const target = toMinutes(year, month, day, hour, minute);
  let nearest = candidates[0];
  let best = Infinity;

  for (const t of candidates) {
    const delta = target - toMinutes(t.year, t.month, t.day, t.hour, t.minute);
    if (Math.abs(delta) < Math.abs(best)) {
      best = delta;
      nearest = t;
    }
  }

  return {
    isAmbiguous: Math.abs(best) <= TERM_ACCURACY_MINUTES,
    nearest,
    minutesFromTerm: best,
  };
}
