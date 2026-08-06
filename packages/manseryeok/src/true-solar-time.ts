/**
 * 진태양시(眞太陽時) — 시계가 아니라 태양이 가리키는 시각.
 * 사주의 시주는 시계가 아니라 태양 위치로 결정되므로 이 보정이 먼저다.
 *
 *   벽시계 시각
 *      │
 *      ├─ 서머타임이면 −60분              (시계가 앞서 있었으므로 되돌림)
 *      ├─ 경도차 보정  (경도 − 자오선)×4분  (서울 126.98°E 기준)
 *      │     자오선 135°E → −32.1분
 *      │     자오선 127.5°E → −2.1분        ← 1954~1961 구간
 *      └─ 균시차(EoT) −14 ~ +16분           (기본 off, 아래 설명)
 *      ▼
 *   진태양시
 *
 * ⚠️ 균시차를 쓸 것인가는 유파가 갈리는 지점이다. 국내 만세력 다수는 경도 보정만
 *    하고 균시차는 무시한다. 천문학적으로는 균시차까지 넣는 게 맞지만, 그렇게 하면
 *    시중 만세력과 결과가 갈린다. 기본값은 off로 두고 교차검증(T17)에서
 *    독립 오라클 2개와 대조해 확정한다. 여기가 이 엔진에서 가장 조정이 필요한 노브다.
 */

import { isDst, meridianFor } from './timezone.ts';

/** 서울 경도. 출생지를 입력받게 되면 이 값이 파라미터가 된다. */
export const SEOUL_LONGITUDE = 126.978;

/** 경도 1도 = 4분 */
const MINUTES_PER_DEGREE = 4;

export interface TrueSolarOptions {
  /** 관측 경도(동경 도). 기본 서울. */
  longitude?: number;
  /**
   * 균시차를 적용할지. 기본 false — 국내 만세력 다수 관행에 맞춘다.
   * 교차검증에서 오라클이 균시차를 쓰는 것으로 확인되면 true로 바꾼다.
   */
  useEquationOfTime?: boolean;
}

/** 벽시계에 적힌 값. 타임존 해석 없이 그대로 받는다. */
export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number; // 0-59
}

export interface TrueSolarResult {
  /** 보정 후 진태양시 (날짜가 넘어갈 수 있다) */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 벽시계 대비 총 보정량(분). 음수면 뒤로 당겨진 것. */
  offsetMinutes: number;
  /** 내역 — 왜 이렇게 나왔는지 사용자에게 보여줄 때 쓴다 */
  breakdown: {
    dst: number;
    longitude: number;
    equationOfTime: number;
  };
}

/** 그 해의 며칠째인지 (1-366) */
function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const target = Date.UTC(year, month - 1, day);
  return Math.round((target - start) / 86400000) + 1;
}

/**
 * 균시차 (분). 표준 근사식, 오차 ~30초.
 * 출생 시각은 분 단위로 기록되므로 30초 오차는 시주 경계 ±30초에서만 문제가 된다.
 */
export function equationOfTime(year: number, month: number, day: number): number {
  const n = dayOfYear(year, month, day);
  const b = (2 * Math.PI * (n - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function toTrueSolarTime(clock: WallClock, options: TrueSolarOptions = {}): TrueSolarResult {
  const longitude = options.longitude ?? SEOUL_LONGITUDE;
  const { year, month, day, hour, minute } = clock;

  const dst = isDst(year, month, day) ? -60 : 0;
  const meridian = meridianFor(year, month, day);
  const longitudeAdj = (longitude - meridian) * MINUTES_PER_DEGREE;
  const eot = options.useEquationOfTime ? equationOfTime(year, month, day) : 0;

  const offsetMinutes = dst + longitudeAdj + eot;

  // 분 단위로 반올림한 뒤 날짜 연산은 Date에 맡긴다. 월말·윤년 경계를 직접
  // 계산하면 반드시 어딘가 틀린다.
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute));
  shifted.setUTCMinutes(shifted.getUTCMinutes() + Math.round(offsetMinutes));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    offsetMinutes: Math.round(offsetMinutes),
    breakdown: {
      dst,
      longitude: Math.round(longitudeAdj * 10) / 10,
      equationOfTime: Math.round(eot * 10) / 10,
    },
  };
}
