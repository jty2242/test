import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_ANCHOR,
  dayPillarFromDate,
  hourBranchIndex,
  hourStemIndex,
  toGanji,
  dayAndHourPillars,
} from '../src/day-hour-pillar.ts';
import { ganjiName, stemOf, branchOf } from '../src/types.ts';

// ── 일주 ─────────────────────────────────────────────────────────────────
// 앵커 값 자체는 아직 미검증이다(T17). 아래 테스트들은 앵커가 무엇이든
// 성립해야 하는 성질 — 주기성·연속성·부호 처리 — 를 잠근다.
// 앵커가 바뀌면 첫 테스트 하나만 고치면 된다.

test('앵커 날짜는 정의상 甲子일', () => {
  const g = dayPillarFromDate(DAY_ANCHOR.year, DAY_ANCHOR.month, DAY_ANCHOR.day);
  assert.equal(g, DAY_ANCHOR.ganji);
  assert.equal(ganjiName(g), '甲子');
});

test('하루 지나면 정확히 한 칸 나아간다', () => {
  let prev = dayPillarFromDate(1998, 3, 1);
  for (let d = 2; d <= 31; d++) {
    const cur = dayPillarFromDate(1998, 3, d);
    assert.equal(cur, (prev + 1) % 60, `1998-03-${d}에서 끊김`);
    prev = cur;
  }
});

test('60일 주기가 정확히 맞는다', () => {
  const start = dayPillarFromDate(2000, 1, 1);
  const after60 = dayPillarFromDate(2000, 3, 1); // 2000년은 윤년: 1월31+2월29 = 60일
  assert.equal(after60, start);
});

test('앵커 이전 날짜도 음수 없이 나온다', () => {
  for (const [y, m, d] of [[1900, 1, 1], [1912, 5, 20], [1950, 12, 31], [1983, 12, 31]] as const) {
    const g = dayPillarFromDate(y, m, d);
    assert.ok(Number.isInteger(g) && g >= 0 && g < 60, `${y}-${m}-${d} → ${g}`);
  }
  // 앵커 하루 전은 癸亥(59)
  assert.equal(dayPillarFromDate(1984, 2, 1), 59);
});

test('월말·연말·윤년 경계에서 끊기지 않는다', () => {
  assert.equal(dayPillarFromDate(1999, 1, 1), (dayPillarFromDate(1998, 12, 31) + 1) % 60);
  assert.equal(dayPillarFromDate(2000, 3, 1), (dayPillarFromDate(2000, 2, 29) + 1) % 60);
  assert.equal(dayPillarFromDate(1900, 3, 1), (dayPillarFromDate(1900, 2, 28) + 1) % 60, '1900년은 평년');
});

// ── 시지 ─────────────────────────────────────────────────────────────────

test('子시는 23시와 0시를 함께 덮는다', () => {
  assert.equal(hourBranchIndex(23), 0);
  assert.equal(hourBranchIndex(0), 0);
  assert.equal(hourBranchIndex(1), 1, '丑');
  assert.equal(hourBranchIndex(2), 1);
  assert.equal(hourBranchIndex(3), 2, '寅');
  assert.equal(hourBranchIndex(12), 6, '午');
  assert.equal(hourBranchIndex(13), 7, '未');
  assert.equal(hourBranchIndex(22), 11, '亥');
});

test('24시간이 12지지를 정확히 두 시간씩 덮는다', () => {
  const counts = new Array(12).fill(0);
  for (let h = 0; h < 24; h++) counts[hourBranchIndex(h)]++;
  assert.deepEqual(counts, new Array(12).fill(2));
});

// ── 시간(오서둔) ─────────────────────────────────────────────────────────

test('오서둔 — 일간별 子시 천간', () => {
  // 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
  const expected: Array<[string, string]> = [
    ['甲', '甲'], ['乙', '丙'], ['丙', '戊'], ['丁', '庚'], ['戊', '壬'],
    ['己', '甲'], ['庚', '丙'], ['辛', '戊'], ['壬', '庚'], ['癸', '壬'],
  ];
  for (let dayStem = 0; dayStem < 10; dayStem++) {
    // 해당 천간을 가진 아무 일주나 잡는다
    const dayGanji = dayStem % 2 === 0 ? dayStem : dayStem + 10;
    const [dayName, ziName] = expected[dayStem];
    assert.equal(stemOf(dayGanji), dayName, '테스트 셋업 확인');
    const zi = hourStemIndex(dayGanji, 0);
    assert.equal(stemOf(zi), ziName, `일간 ${dayName}의 子시 천간`);
  }
});

test('시간은 지지를 따라 순행한다', () => {
  const dayGanji = 6; // 庚午 — 일간 庚
  for (let b = 0; b < 12; b++) {
    assert.equal(hourStemIndex(dayGanji, b), (hourStemIndex(dayGanji, 0) + b) % 10);
  }
});

test('toGanji는 불가능한 조합을 거부한다', () => {
  assert.equal(ganjiName(toGanji(0, 0)), '甲子');
  assert.equal(ganjiName(toGanji(6, 6)), '庚午');
  // 천간 짝수는 지지 짝수하고만 짝이 된다. 甲(0) + 丑(1)은 존재하지 않는다.
  assert.throws(() => toGanji(0, 1), /불가능한 간지 조합/);
});

test('60갑자 전체가 천간·지지 짝과 일대일 대응', () => {
  for (let i = 0; i < 60; i++) {
    assert.equal(toGanji(i % 10, i % 12), i);
    assert.equal(ganjiName(i), stemOf(i) + branchOf(i));
  }
});

// ── 자시 정책 ────────────────────────────────────────────────────────────

test('야자시는 23시대를 다음날로 넘긴다', () => {
  const m = { year: 1998, month: 3, day: 14, hour: 23 };
  const yaja = dayAndHourPillars(m, 'yaja');
  const joja = dayAndHourPillars(m, 'joja');

  assert.equal(joja.day, dayPillarFromDate(1998, 3, 14), '조자시는 오늘 일주');
  assert.equal(yaja.day, dayPillarFromDate(1998, 3, 15), '야자시는 내일 일주');
  assert.notEqual(yaja.day, joja.day);
  assert.notEqual(yaja.hour, joja.hour, '일간이 다르니 시주도 다르다');
});

test('23시대 밖에서는 두 유파가 같은 결과를 낸다', () => {
  for (const hour of [0, 1, 7, 12, 18, 22]) {
    const m = { year: 1998, month: 3, day: 14, hour };
    assert.deepEqual(
      dayAndHourPillars(m, 'yaja'),
      dayAndHourPillars(m, 'joja'),
      `${hour}시에서 갈리면 안 됨`,
    );
  }
});

test('야자시가 월말·연말을 넘어도 날짜 연산이 깨지지 않는다', () => {
  const endOfYear = dayAndHourPillars({ year: 1998, month: 12, day: 31, hour: 23 }, 'yaja');
  assert.equal(endOfYear.day, dayPillarFromDate(1999, 1, 1));

  const leap = dayAndHourPillars({ year: 2000, month: 2, day: 28, hour: 23 }, 'yaja');
  assert.equal(leap.day, dayPillarFromDate(2000, 2, 29), '윤년 2/29로 가야 함');
});

test('시각을 모르면 시주가 없고 자시 정책도 영향이 없다', () => {
  const m = { year: 1998, month: 3, day: 14, hour: null };
  const yaja = dayAndHourPillars(m, 'yaja');
  const joja = dayAndHourPillars(m, 'joja');
  assert.equal(yaja.hour, null);
  assert.deepEqual(yaja, joja);
  assert.equal(yaja.day, dayPillarFromDate(1998, 3, 14));
});

test('시주는 항상 유효한 60갑자다 — 전 시각 × 전 일주', () => {
  for (let d = 0; d < 60; d++) {
    for (let h = 0; h < 24; h++) {
      const branch = hourBranchIndex(h);
      const stem = hourStemIndex(d, branch);
      const g = toGanji(stem, branch); // 불가능 조합이면 여기서 throw
      assert.ok(g >= 0 && g < 60);
    }
  }
});
