/**
 * 한국 표준시의 역사 — IANA tzdata(Asia/Seoul)에서 파생한다. 손으로 표를 들고
 * 있지 않는다. Node에 tzdata가 내장돼 있고 Node를 올리면 같이 갱신된다.
 *
 * 흔한 오해: 한국은 항상 UTC+9였다 → 아니다.
 *
 *   ~1908-04-01  +8:27   지방시 (표준시 제정 이전)
 *   1908-04-01   +8:30   기준 127.5°E  ← 경도 보정 ~0
 *   1912-01-01   +9:00   기준 135°E    ← 경도 보정 -32분
 *   1954-03-21   +8:30   기준 127.5°E  ← 경도 보정 ~0
 *   1961-08-10   +9:00   기준 135°E    ← 현재까지
 *
 *   서머타임 12회: 1948~1951, 1955~1960, 1987~1988. 전부 정확히 +60분.
 *   전환 시각이 자정이 아니다 (1955~60은 00:30, 1987~88은 02:00/03:00).
 *   날짜 단위로만 판정하면 전환일 새벽 출생자가 한 시간 어긋난다.
 *
 * 관측 가능한 오프셋은 네 가지뿐이다: 507 / 510 / 540 / 570 / 600.
 * 서머타임이 항상 +60분이므로 기저 오프셋과 서머타임 여부가 오프셋 하나에서
 * 갈라진다. 기준 자오선은 기저 오프셋 ÷ 4 (1도 = 4분).
 */

const TZ = 'Asia/Seoul';

const OFFSET_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  timeZoneName: 'longOffset',
});

/** 서머타임은 한국에서 항상 정확히 +60분이었다. */
const DST_MINUTES = 60;

/** 서머타임이 걸린 오프셋 → 기저 오프셋 */
const DST_OFFSETS = new Set([570, 600]);

export interface KoreaTimeContext {
  /** 벽시계에 대응하는 UTC 순간 */
  utcMs: number;
  /** 그 순간의 실제 오프셋 (분). 서머타임 포함. */
  offsetMinutes: number;
  /** 서머타임을 뺀 표준시 오프셋 (분) */
  baseOffsetMinutes: number;
  isDst: boolean;
  /** 기준 자오선 (동경 도). 기저 오프셋 ÷ 4. */
  meridianDeg: number;
}

/** UTC 순간의 Asia/Seoul 오프셋(분). tzdata 조회. */
export function offsetAtUtc(utcMs: number): number {
  const part = OFFSET_FORMAT.formatToParts(new Date(utcMs)).find(
    (p) => p.type === 'timeZoneName',
  );
  const m = part?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) throw new Error(`오프셋을 읽지 못했습니다: ${part?.value}`);
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * 벽시계에 적힌 시각 → 그 시각의 시간대 맥락.
 *
 * Intl은 UTC→로컬 방향만 주므로 역방향은 한 번 추정하고 수렴시킨다.
 * 서머타임 해제일의 되풀이되는 한 시간은 표준시 쪽으로 해석된다.
 * 역사상 12일에만 해당하고, 그 경계는 어차피 교차검증에서 손으로 확정한다.
 */
export function koreaTimeContext(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): KoreaTimeContext {
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  let utcMs = naive - 9 * 60 * 60000;
  for (let i = 0; i < 3; i++) {
    const next = naive - offsetAtUtc(utcMs) * 60000;
    if (next === utcMs) break;
    utcMs = next;
  }

  const offsetMinutes = offsetAtUtc(utcMs);
  const isDst = DST_OFFSETS.has(offsetMinutes);
  const baseOffsetMinutes = isDst ? offsetMinutes - DST_MINUTES : offsetMinutes;

  return {
    utcMs,
    offsetMinutes,
    baseOffsetMinutes,
    isDst,
    meridianDeg: baseOffsetMinutes / 4,
  };
}

/** 그 벽시계 시각에 서머타임이 걸려 있었나. 기본 정오 — 전환 시각을 피한다. */
export function isDst(year: number, month: number, day: number, hour = 12, minute = 0): boolean {
  return koreaTimeContext(year, month, day, hour, minute).isDst;
}

/** 그 벽시계 시각의 기준 자오선 (동경 도). */
export function meridianFor(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return koreaTimeContext(year, month, day, hour, minute).meridianDeg;
}

/** 표준시 오프셋(분). 서머타임 포함. */
export function standardOffsetMinutes(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): number {
  return koreaTimeContext(year, month, day, hour, minute).offsetMinutes;
}
