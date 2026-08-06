import test from 'node:test';
import assert from 'node:assert/strict';

import {
  YEAR_ANCHOR,
  yearPillar,
  monthPillar,
  sajuYear,
  precedingMonthTerm,
  isYangYear,
} from '../src/year-month-pillar.ts';
import { luckDirection, daeun } from '../src/daeun.ts';
import { ganjiName, stemOf, branchOf } from '../src/types.ts';
import { solarTerm } from '../src/solar-terms.ts';

const noon = (year: number, month: number, day: number, hour = 12, minute = 0) => ({
  year, month, day, hour, minute,
});

// ── 년주 ─────────────────────────────────────────────────────────────────

test('1984년은 갑자년 — KASI 세차로 확인된 값', () => {
  assert.equal(yearPillar(noon(1984, 6, 1)), 0);
  assert.equal(ganjiName(yearPillar(noon(1984, 6, 1))), '甲子');
  assert.equal(YEAR_ANCHOR.year, 1984);
});

test('년주는 60년마다 돌아온다', () => {
  assert.equal(yearPillar(noon(1924, 6, 1)), yearPillar(noon(1984, 6, 1)));
  assert.equal(yearPillar(noon(2044, 6, 1)), yearPillar(noon(1984, 6, 1)));
});

test('입춘이 해를 가른다 — 달력 1월 1일이 아니다', () => {
  const ipchun = solarTerm(2024, '입춘');
  assert.equal(ipchun.month, 2);

  // 1월생은 아직 전해
  assert.equal(sajuYear(noon(2024, 1, 15)), 2023);
  assert.equal(yearPillar(noon(2024, 1, 15)), yearPillar(noon(2023, 6, 1)));

  // 입춘 지나면 그해
  assert.equal(sajuYear(noon(2024, 3, 1)), 2024);
  assert.equal(yearPillar(noon(2024, 3, 1)), yearPillar(noon(2024, 6, 1)));
});

test('입춘 당일 분 단위로 년주가 넘어간다', () => {
  const t = solarTerm(2024, '입춘');
  const before = { ...noon(t.year, t.month, t.day, t.hour, t.minute), minute: t.minute - 1 };
  const after = noon(t.year, t.month, t.day, t.hour, t.minute);

  assert.equal(sajuYear(before), 2023, '절입 1분 전은 전해');
  assert.equal(sajuYear(after), 2024, '절입 시각부터 그해');
  assert.notEqual(yearPillar(before), yearPillar(after));
});

// ── 월주 ─────────────────────────────────────────────────────────────────

test('입춘이 寅월을 연다 — 사주의 해는 子월이 아니라 寅월에서 시작', () => {
  const t = solarTerm(2024, '입춘');
  const justAfter = noon(t.year, t.month, t.day, t.hour, t.minute);
  assert.equal(branchOf(monthPillar(justAfter)), '寅');
});

test('12절이 12개월을 순서대로 연다', () => {
  const expected: Array<[string, string]> = [
    ['입춘', '寅'], ['경칩', '卯'], ['청명', '辰'], ['입하', '巳'],
    ['망종', '午'], ['소서', '未'], ['입추', '申'], ['백로', '酉'],
    ['한로', '戌'], ['입동', '亥'], ['대설', '子'], ['소한', '丑'],
  ];
  for (const [term, branch] of expected) {
    const t = solarTerm(2024, term as never);
    const m = noon(t.year, t.month, t.day, t.hour, t.minute + 1);
    assert.equal(branchOf(monthPillar(m)), branch, `${term} 다음은 ${branch}월`);
  }
});

test('중기는 월을 가르지 않는다 — 우수 전후로 월주가 같다', () => {
  const usu = solarTerm(2024, '우수');
  const before = noon(usu.year, usu.month, usu.day, usu.hour, usu.minute - 1);
  const after = noon(usu.year, usu.month, usu.day, usu.hour, usu.minute + 1);
  assert.equal(monthPillar(before), monthPillar(after));
  assert.equal(branchOf(monthPillar(after)), '寅', '우수는 寅월 한가운데');
});

test('오호둔 — 년간별 寅월 천간', () => {
  // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const expected: Record<string, string> = {
    甲: '丙', 乙: '戊', 丙: '庚', 丁: '壬', 戊: '甲',
    己: '丙', 庚: '戊', 辛: '庚', 壬: '壬', 癸: '甲',
  };
  for (let y = 1984; y < 1994; y++) {
    const t = solarTerm(y, '입춘');
    const m = noon(t.year, t.month, t.day, t.hour, t.minute + 1);
    const yearStem = stemOf(yearPillar(m));
    assert.equal(stemOf(monthPillar(m)), expected[yearStem], `${y}년(${yearStem}년)의 寅월 천간`);
  }
});

test('월주는 한 해 안에서 12칸 순행한다', () => {
  const t0 = solarTerm(2024, '입춘');
  let prev = monthPillar(noon(t0.year, t0.month, t0.day, t0.hour, t0.minute + 1));
  for (const term of ['경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동'] as const) {
    const t = solarTerm(2024, term);
    const cur = monthPillar(noon(t.year, t.month, t.day, t.hour, t.minute + 1));
    assert.equal(cur, (prev + 1) % 60, `${term}에서 월주가 한 칸 안 나아감`);
    prev = cur;
  }
});

test('precedingMonthTerm은 늘 절(節)을 돌려준다', () => {
  for (const [m, d] of [[1, 1], [3, 15], [6, 30], [9, 9], [12, 31]] as const) {
    const term = precedingMonthTerm(noon(2024, m, d));
    assert.ok(term.isMonthBoundary, `${m}/${d} → ${term.name}은 절이 아님`);
  }
});

// ── 대운 ─────────────────────────────────────────────────────────────────

test('대운 방향 — 양년남·음년여는 순행', () => {
  const gapja = 0; // 甲子, 양년
  const eulchuk = 1; // 乙丑, 음년
  assert.ok(isYangYear(gapja));
  assert.ok(!isYangYear(eulchuk));

  assert.equal(luckDirection(gapja, 'male'), 'forward', '양년 남자');
  assert.equal(luckDirection(gapja, 'female'), 'reverse', '양년 여자');
  assert.equal(luckDirection(eulchuk, 'male'), 'reverse', '음년 남자');
  assert.equal(luckDirection(eulchuk, 'female'), 'forward', '음년 여자');
});

test('성별이 바뀌면 대운이 정반대로 흐른다 — 판코드에 성별이 필요한 이유', () => {
  const m = noon(1998, 3, 14);
  const y = yearPillar(m);
  const mo = monthPillar(m);

  const male = daeun(m, y, mo, 'male');
  const female = daeun(m, y, mo, 'female');

  assert.notEqual(male.direction, female.direction);
  // 첫 대운이 월주 기준 반대편에 놓인다
  assert.equal(male.pillars[0].ganji, (mo + (male.direction === 'forward' ? 1 : 59)) % 60);
  assert.equal(female.pillars[0].ganji, (mo + (female.direction === 'forward' ? 1 : 59)) % 60);
});

test('대운은 월주에서 한 칸씩 이어진다', () => {
  const m = noon(1998, 3, 14);
  const y = yearPillar(m);
  const mo = monthPillar(m);
  const d = daeun(m, y, mo, 'male', 8);

  assert.equal(d.pillars.length, 8);
  const step = d.direction === 'forward' ? 1 : -1;
  for (let i = 0; i < 8; i++) {
    assert.equal(d.pillars[i].ganji, (((mo + step * (i + 1)) % 60) + 60) % 60);
    assert.equal(d.pillars[i].ordinal, i + 1);
    assert.equal(d.pillars[i].startAge, d.startAge + i * 10);
  }
});

test('대운수는 절까지의 거리를 3으로 나눈 값', () => {
  const m = noon(1998, 3, 14);
  const y = yearPillar(m);
  const mo = monthPillar(m);

  // 절(節)끼리는 30도 간격이다 — 사이에 중기가 하나씩 끼므로 약 30일.
  // 따라서 절까지의 거리는 최대 ~31일이고 대운수는 최대 10이 된다.
  for (const gender of ['male', 'female'] as const) {
    const d = daeun(m, y, mo, gender);
    assert.equal(d.startAge, Math.max(1, Math.round(d.daysToTerm / 3)));
    assert.ok(d.daysToTerm >= 0 && d.daysToTerm <= 32, `절까지 ${d.daysToTerm}일`);
    assert.ok(d.startAge >= 1 && d.startAge <= 11, `대운수 ${d.startAge}`);
  }
});

test('순행과 역행의 대운수를 더하면 한 달(절~절)이 된다', () => {
  // 순행은 다음 절까지, 역행은 지난 절부터. 둘을 더하면 절기 한 구간(약 30일).
  const m = noon(1998, 3, 14, 7, 20);
  const y = yearPillar(m);
  const mo = monthPillar(m);
  const fwd = daeun(m, y, mo, isYangYear(y) ? 'male' : 'female');
  const rev = daeun(m, y, mo, isYangYear(y) ? 'female' : 'male');

  assert.equal(fwd.direction, 'forward');
  assert.equal(rev.direction, 'reverse');
  const total = fwd.daysToTerm + rev.daysToTerm;
  assert.ok(total > 29 && total < 32, `합계 ${total.toFixed(2)}일`);
});

test('절과 절 사이는 약 30일이다 — 중기가 하나 끼어 있다', () => {
  const gyeongchip = solarTerm(2024, '경칩');
  const cheongmyeong = solarTerm(2024, '청명');
  const days =
    (Date.UTC(cheongmyeong.year, cheongmyeong.month - 1, cheongmyeong.day, cheongmyeong.hour, cheongmyeong.minute) -
      Date.UTC(gyeongchip.year, gyeongchip.month - 1, gyeongchip.day, gyeongchip.hour, gyeongchip.minute)) /
    86400000;
  assert.ok(days > 29 && days < 32, `경칩→청명 ${days.toFixed(2)}일`);
  // 그 사이에 춘분(중기)이 있다
  const chunbun = solarTerm(2024, '춘분');
  assert.ok(!chunbun.isMonthBoundary, '춘분은 중기라 월을 안 가름');
});
