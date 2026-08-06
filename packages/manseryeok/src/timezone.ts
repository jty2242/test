/**
 * 한국 표준시의 역사. 시계가 가리킨 시각을 실제 태양 위치로 되돌리려면
 * "그때 그 시계가 어느 자오선을 기준으로 돌고 있었나"를 먼저 알아야 한다.
 *
 * 흔한 오해: 한국은 항상 UTC+9였다 → 아니다. 1954~1961년에는 UTC+8:30이었고,
 * 그 기준 자오선(127.5°E)이 서울의 실제 경도와 거의 같다. 즉 이 기간 출생자는
 * 경도 보정이 사실상 0이다. 이걸 모르고 일괄 -32분을 빼면 8년치가 통째로 틀린다.
 *
 *   1908-04-01  UTC+8:30   기준 127.5°E   ← 경도 보정 ~0
 *   1912-01-01  UTC+9:00   기준 135°E     ← 경도 보정 -32분
 *   1954-03-21  UTC+8:30   기준 127.5°E   ← 경도 보정 ~0
 *   1961-08-10  UTC+9:00   기준 135°E     ← 현재까지
 *
 * 여기에 서머타임이 겹친다. 서머타임 기간에는 시계가 한 시간 앞서 있으므로
 * 태양시로 되돌릴 때 한 시간을 도로 빼야 한다.
 *
 * ⚠️ 아래 날짜들은 교차검증(T17)에서 독립 오라클 2개와 대조해 확정할 것.
 *    특히 서머타임 시행/해제 일자는 자료마다 하루씩 어긋나는 경우가 있다.
 */

/** 표준 자오선 전환. KST 기준 로컬 날짜가 아니라 UTC 순간으로 잡는다. */
interface MeridianPeriod {
  /** 이 순간부터 적용 (UTC ms) */
  fromUtc: number;
  /** 표준시 오프셋 (분) */
  offsetMinutes: number;
  /** 기준 자오선 (동경 도) */
  meridianDeg: number;
}

const H = 60;

const MERIDIAN_HISTORY: readonly MeridianPeriod[] = [
  { fromUtc: Date.UTC(1908, 3, 1, 0, 0) - 8.5 * H * 60000, offsetMinutes: 8.5 * H, meridianDeg: 127.5 },
  { fromUtc: Date.UTC(1912, 0, 1, 0, 0) - 9 * H * 60000, offsetMinutes: 9 * H, meridianDeg: 135 },
  { fromUtc: Date.UTC(1954, 2, 21, 0, 0) - 8.5 * H * 60000, offsetMinutes: 8.5 * H, meridianDeg: 127.5 },
  { fromUtc: Date.UTC(1961, 7, 10, 0, 0) - 9 * H * 60000, offsetMinutes: 9 * H, meridianDeg: 135 },
];

/** 서머타임 시행 구간. [시작, 끝) 로컬 날짜 (해당 연도 표준시 기준). */
interface DstPeriod {
  startY: number; startM: number; startD: number;
  endY: number; endM: number; endD: number;
}

const DST_PERIODS: readonly DstPeriod[] = [
  { startY: 1948, startM: 6, startD: 1, endY: 1948, endM: 9, endD: 13 },
  { startY: 1949, startM: 4, startD: 3, endY: 1949, endM: 9, endD: 11 },
  { startY: 1950, startM: 4, startD: 1, endY: 1950, endM: 9, endD: 11 },
  { startY: 1951, startM: 5, startD: 6, endY: 1951, endM: 9, endD: 9 },
  { startY: 1955, startM: 5, startD: 5, endY: 1955, endM: 9, endD: 9 },
  { startY: 1956, startM: 5, startD: 20, endY: 1956, endM: 9, endD: 30 },
  { startY: 1957, startM: 5, startD: 5, endY: 1957, endM: 9, endD: 22 },
  { startY: 1958, startM: 5, startD: 4, endY: 1958, endM: 9, endD: 21 },
  { startY: 1959, startM: 5, startD: 3, endY: 1959, endM: 9, endD: 20 },
  { startY: 1960, startM: 5, startD: 1, endY: 1960, endM: 9, endD: 18 },
  { startY: 1987, startM: 5, startD: 10, endY: 1987, endM: 10, endD: 11 },
  { startY: 1988, startM: 5, startD: 8, endY: 1988, endM: 10, endD: 9 },
];

/** 로컬 벽시계 날짜를 비교 가능한 정수로. YYYYMMDD */
function ymd(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

/**
 * 벽시계에 적힌 날짜에 서머타임이 걸려 있었나.
 * 경계일 자체의 시각별 처리는 자료가 불충분해 날짜 단위로만 판정한다.
 * 경계일 출생은 교차검증에서 불일치로 뜰 것이고, 그때 손으로 확정한다.
 */
export function isDst(year: number, month: number, day: number): boolean {
  const t = ymd(year, month, day);
  return DST_PERIODS.some(
    (p) => t >= ymd(p.startY, p.startM, p.startD) && t < ymd(p.endY, p.endM, p.endD),
  );
}

/**
 * 벽시계에 적힌 시각이 어느 표준 자오선 기준이었나.
 * 자오선 전환은 8년 단위라 벽시계 날짜만으로 판정해도 안전하다.
 */
export function meridianFor(year: number, month: number, day: number): number {
  const t = ymd(year, month, day);
  if (t < ymd(1908, 4, 1)) return 127.5; // 표준시 제정 이전 — 지방시를 그대로 쓴 셈
  if (t < ymd(1912, 1, 1)) return 127.5;
  if (t < ymd(1954, 3, 21)) return 135;
  if (t < ymd(1961, 8, 10)) return 127.5;
  return 135;
}

/** 표준시 오프셋(분). 서머타임 포함. 참고용 — 계산에는 meridianFor/isDst를 쓴다. */
export function standardOffsetMinutes(year: number, month: number, day: number): number {
  const base = meridianFor(year, month, day) === 135 ? 9 * H : 8.5 * H;
  return base + (isDst(year, month, day) ? H : 0);
}

export { MERIDIAN_HISTORY, DST_PERIODS };
