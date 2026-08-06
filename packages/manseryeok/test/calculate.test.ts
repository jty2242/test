import test from 'node:test';
import assert from 'node:assert/strict';

import { calculate, InvalidBirthInput, isJasiAmbiguousHour } from '../src/calculate.ts';
import { decodePanCode } from '../src/pan-code.ts';
import { ganjiName } from '../src/types.ts';

const base = { year: 1998, month: 3, day: 14, hour: 7, minute: 20, gender: 'male' as const };

test('네 기둥이 모두 나오고 판코드로 왕복된다', () => {
  const r = calculate(base);
  assert.equal(r.charts.length, 1);
  const c = r.charts[0];
  assert.deepEqual(decodePanCode(c.panCode), c.pan);
  assert.equal(ganjiName(c.pan.year), '戊寅', '1998년은 무인년');
});

test('알려진 년주와 일치한다', () => {
  // KASI 세차로 127건 검증한 것과 같은 축. 대표값만 잠근다.
  const cases: Array<[number, string]> = [
    [1958, '戊戌'], [1984, '甲子'], [1998, '戊寅'], [2000, '庚辰'], [2024, '甲辰'],
  ];
  for (const [year, name] of cases) {
    const r = calculate({ ...base, year, month: 6, day: 1 });
    assert.equal(ganjiName(r.charts[0].pan.year), name, `${year}년`);
  }
});

test('입춘 전 출생은 전해로 계산된다', () => {
  const r = calculate({ ...base, year: 2024, month: 1, day: 15 });
  assert.equal(r.sajuYear, 2023);
  assert.equal(ganjiName(r.charts[0].pan.year), '癸卯', '2023년은 계묘년');
});

test('진태양시 보정이 결과에 반영된다', () => {
  const r = calculate(base);
  assert.ok(r.trueSolarTime);
  assert.equal(r.trueSolarTime.offsetMinutes, -32);
  assert.equal(r.trueSolarTime.hour, 6);
  assert.equal(r.trueSolarTime.minute, 48);
});

test('자시 모호 판정은 진태양시 기준이다 — 벽시계가 아니다', () => {
  // 벽시계 23:45지만 서머타임+127.5도 기준이라 진태양시는 22:43(亥시).
  // 자시가 아니므로 유파가 갈릴 여지가 없다.
  const dst = calculate({ year: 1958, month: 6, day: 15, hour: 23, minute: 45, gender: 'female' });
  assert.equal(dst.trueSolarTime!.hour, 22);
  assert.equal(dst.isJasiAmbiguous, false);
  assert.equal(dst.charts.length, 1);

  // 같은 벽시계라도 보정이 -32분뿐이면 진태양시 23:13(子시) → 갈린다.
  const amb = calculate({ ...base, hour: 23, minute: 45 });
  assert.equal(amb.trueSolarTime!.hour, 23);
  assert.equal(amb.isJasiAmbiguous, true);
  assert.equal(amb.charts.length, 2);
  assert.notEqual(amb.charts[0].pan.day, amb.charts[1].pan.day, '일주가 갈려야 함');
  assert.notEqual(amb.charts[0].pan.hour, amb.charts[1].pan.hour, '시주도 갈려야 함');
});

test('자정 직후 출생도 진태양시로는 전날 자시라 갈린다', () => {
  const r = calculate({ ...base, day: 15, hour: 0, minute: 15 });
  assert.equal(r.trueSolarTime!.hour, 23, '진태양시는 전날 23:43');
  assert.equal(r.isJasiAmbiguous, true);
});

test('두 판은 자시 정책만 다르고 판코드도 다르다', () => {
  const r = calculate({ ...base, hour: 23, minute: 45 });
  const [a, b] = r.charts;
  assert.equal(a.jasi, 'yaja');
  assert.equal(b.jasi, 'joja');
  assert.notEqual(a.panCode, b.panCode);
  assert.equal(a.pan.year, b.pan.year, '년주는 같아야 함');
  assert.equal(a.pan.month, b.pan.month, '월주도 같아야 함');
});

test('시각을 모르면 시주가 없고 진태양시도 없다', () => {
  const r = calculate({ ...base, hour: null });
  assert.equal(r.charts.length, 1);
  assert.equal(r.charts[0].pan.hour, null);
  assert.equal(r.trueSolarTime, null);
  assert.equal(r.isJasiAmbiguous, false);
  // 년월일주는 여전히 나온다
  assert.ok(r.charts[0].pan.day >= 0);
});

test('대운이 성별에 따라 반대로 흐른다', () => {
  const m = calculate({ ...base, gender: 'male' });
  const f = calculate({ ...base, gender: 'female' });
  assert.notEqual(m.charts[0].daeun.direction, f.charts[0].daeun.direction);
  assert.notEqual(m.charts[0].panCode, f.charts[0].panCode, '판코드도 갈려야 함');
});

test('절기 경계 근접이 보고된다', () => {
  const r = calculate({ ...base, year: 2024, month: 1, day: 15 });
  assert.ok('isAmbiguous' in r.termBoundary);
  assert.ok(r.termBoundary.nearest.name.length > 0);
});

// ── 입력 검증 ────────────────────────────────────────────────────────────

test('지원 범위 밖 연도는 필드를 지목해 거부한다', () => {
  for (const year of [1899, 2101]) {
    assert.throws(
      () => calculate({ ...base, year }),
      (e: unknown) => e instanceof InvalidBirthInput && e.field === 'year',
      `${year}년`,
    );
  }
});

test('존재하지 않는 날짜를 거부한다', () => {
  assert.throws(
    () => calculate({ ...base, month: 2, day: 30 }),
    (e: unknown) => e instanceof InvalidBirthInput && e.field === 'day',
  );
  assert.throws(
    () => calculate({ ...base, year: 1999, month: 2, day: 29 }),
    (e: unknown) => e instanceof InvalidBirthInput && e.field === 'day',
    '1999년은 평년',
  );
  // 2000년은 윤년이라 통과해야 한다
  assert.doesNotThrow(() => calculate({ ...base, year: 2000, month: 2, day: 29 }));
});

test('잘못된 시·분·성별을 거부한다', () => {
  assert.throws(() => calculate({ ...base, hour: 24 }), InvalidBirthInput);
  assert.throws(() => calculate({ ...base, minute: 60 }), InvalidBirthInput);
  assert.throws(() => calculate({ ...base, gender: 'x' as never }), InvalidBirthInput);
});

test('isJasiAmbiguousHour는 23시대만 참', () => {
  assert.equal(isJasiAmbiguousHour(23), true);
  assert.equal(isJasiAmbiguousHour(22), false);
  assert.equal(isJasiAmbiguousHour(0), false);
  assert.equal(isJasiAmbiguousHour(null), false);
});
