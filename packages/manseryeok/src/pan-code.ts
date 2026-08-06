/**
 * 판코드 — 사주판을 5글자 문자열로. URL 주소이자 캐시 키이자 OG 이미지 키.
 *
 * 생년월일시를 URL에 넣지 않는 게 핵심이다. 판코드는 사주판만 담으므로
 * 링크가 유출돼도 생일이 새지 않는다. 같은 판이면 같은 코드 = 캐시가 공유된다.
 *
 *   년(60) · 월(60) · 일(60) · 시(61: 60갑자 + 모름) · 성별(2) · 자시정책(2)
 *   ────────────────────────────────────────────────────────────────
 *   60·60·60·61·2·2 = 52,704,000 < 36^5 = 60,466,176  →  base36 5글자
 *
 * 성별과 자시정책이 왜 들어가나:
 *   성별   대운의 순행·역행이 성별 × 년간 음양으로 갈린다. 같은 8글자라도
 *          성별이 다르면 대운이 정반대다. 빠지면 절반의 사용자에게 틀린 결과가 캐시된다.
 *   자시   23시대 출생자는 유파에 따라 일주와 시주가 동시에 바뀐다.
 *
 * ⚠️ 이 인코딩은 되돌릴 수 없는 문(one-way door)이다. 배포 후 자릿수나 순서를
 *    바꾸면 이미 공유된 모든 링크가 다른 결과로 연결되고 캐시가 전부 무효화된다.
 *    바꿔야 한다면 새 접두사를 붙인 v2 포맷을 만들고 v1을 계속 디코딩해라.
 */

import type { GanjiIndex, Gender, JasiPolicy, Pan } from './types.ts';

const GANJI = 60;
/** 시주는 60갑자 + "모름" 한 자리 */
const HOUR_SLOTS = GANJI + 1;
const HOUR_UNKNOWN = GANJI;
const CODE_LENGTH = 5;

const GENDERS: readonly Gender[] = ['male', 'female'];
const JASI: readonly JasiPolicy[] = ['yaja', 'joja'];

export class MalformedPanCode extends Error {
  constructor(code: string, reason: string) {
    super(`판코드를 읽을 수 없습니다 (${reason}): ${code}`);
    this.name = 'MalformedPanCode';
  }
}

export class InvalidPan extends Error {
  constructor(reason: string) {
    super(`사주판이 올바르지 않습니다: ${reason}`);
    this.name = 'InvalidPan';
  }
}

function assertGanji(value: GanjiIndex, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= GANJI) {
    throw new InvalidPan(`${field}=${value} — 60갑자 인덱스는 0~59여야 합니다`);
  }
}

export function encodePanCode(pan: Pan): string {
  assertGanji(pan.year, 'year');
  assertGanji(pan.month, 'month');
  assertGanji(pan.day, 'day');
  if (pan.hour !== null) assertGanji(pan.hour, 'hour');

  const genderIdx = GENDERS.indexOf(pan.gender);
  const jasiIdx = JASI.indexOf(pan.jasi);
  if (genderIdx < 0) throw new InvalidPan(`gender=${pan.gender}`);
  if (jasiIdx < 0) throw new InvalidPan(`jasi=${pan.jasi}`);

  const hourSlot = pan.hour ?? HOUR_UNKNOWN;

  let n = pan.year;
  n = n * GANJI + pan.month;
  n = n * GANJI + pan.day;
  n = n * HOUR_SLOTS + hourSlot;
  n = n * GENDERS.length + genderIdx;
  n = n * JASI.length + jasiIdx;

  return n.toString(36).padStart(CODE_LENGTH, '0');
}

export function decodePanCode(code: string): Pan {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) {
    throw new MalformedPanCode(String(code), `${CODE_LENGTH}글자가 아님`);
  }
  if (!/^[0-9a-z]{5}$/.test(code)) {
    throw new MalformedPanCode(code, '허용되지 않는 문자');
  }

  let n = Number.parseInt(code, 36);
  if (!Number.isSafeInteger(n)) throw new MalformedPanCode(code, '숫자로 변환 실패');

  const jasi = JASI[n % JASI.length];
  n = Math.floor(n / JASI.length);
  const gender = GENDERS[n % GENDERS.length];
  n = Math.floor(n / GENDERS.length);
  const hourSlot = n % HOUR_SLOTS;
  n = Math.floor(n / HOUR_SLOTS);
  const day = n % GANJI;
  n = Math.floor(n / GANJI);
  const month = n % GANJI;
  n = Math.floor(n / GANJI);
  const year = n;

  // 상위 자리가 남으면 유효 범위 밖 코드다. 남의 링크를 추측해서 만든 문자열이
  // 조용히 그럴듯한 사주판으로 디코딩되는 걸 여기서 막는다.
  if (year >= GANJI) throw new MalformedPanCode(code, '범위 밖');

  return { year, month, day, hour: hourSlot === HOUR_UNKNOWN ? null : hourSlot, gender, jasi };
}
