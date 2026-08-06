import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ELEMENTS,
  elementOfStem,
  elementOfBranch,
  elementBalance,
} from '../src/elements.ts';
import { stemOf, branchOf, type Pan } from '../src/types.ts';
import { calculate } from '../src/calculate.ts';

test('천간 오행 — 두 개씩 목화토금수', () => {
  const expected: Record<string, string> = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
  };
  for (let i = 0; i < 60; i++) {
    assert.equal(elementOfStem(i), expected[stemOf(i)], `${stemOf(i)}`);
  }
});

test('지지 오행 — 토가 네 개(辰戌丑未)라 고르지 않다', () => {
  const expected: Record<string, string> = {
    子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
    午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
  };
  for (let i = 0; i < 60; i++) {
    assert.equal(elementOfBranch(i), expected[branchOf(i)], `${branchOf(i)}`);
  }
  // 지지 12개의 오행 분포: 목2 화2 토4 금2 수2
  const dist: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (let b = 0; b < 12; b++) {
    // 각 지지를 한 번씩 — 인덱스 b인 60갑자 중 아무거나
    const g = [...Array(60).keys()].find((i) => i % 12 === b)!;
    dist[elementOfBranch(g)]++;
  }
  assert.deepEqual(dist, { 木: 2, 火: 2, 土: 4, 金: 2, 水: 2 });
});

test('오행 합계가 글자 수와 맞는다', () => {
  const withHour = calculate({ year: 1998, month: 3, day: 14, hour: 7, minute: 20, gender: 'male' });
  const b1 = elementBalance(withHour.charts[0].pan);
  assert.equal(b1.total, 8);
  assert.equal(Object.values(b1.counts).reduce((a, b) => a + b, 0), 8);

  const noHour = calculate({ year: 1998, month: 3, day: 14, hour: null, gender: 'male' });
  const b2 = elementBalance(noHour.charts[0].pan);
  assert.equal(b2.total, 6, '시주가 없으면 6글자');
  assert.equal(Object.values(b2.counts).reduce((a, b) => a + b, 0), 6);
});

test('없는 오행이 결과에 남는다 — 카드의 빈칸이 이야깃거리다', () => {
  // 木만 나오도록 억지로 만든 판: 甲寅(50) 반복
  const allWood: Pan = { year: 50, month: 50, day: 50, hour: 50, gender: 'male', jasi: 'yaja' };
  const b = elementBalance(allWood);
  assert.equal(b.counts.木, 8);
  assert.equal(b.dominant, '木');
  assert.deepEqual(b.missing, ['火', '土', '金', '水']);
  // 0인 오행이 counts에서 사라지지 않아야 한다
  for (const e of ELEMENTS) assert.ok(e in b.counts);
});

test('실제 사주의 오행 균형', () => {
  const r = calculate({ year: 1998, month: 3, day: 14, hour: 7, minute: 20, gender: 'male' });
  // 戊寅 乙卯 庚申 己卯
  const b = elementBalance(r.charts[0].pan);
  assert.equal(b.counts.木, 4, '寅卯卯 + 乙');
  assert.equal(b.counts.土, 2, '戊己');
  assert.equal(b.counts.金, 2, '庚申');
  assert.equal(b.counts.火, 0);
  assert.equal(b.counts.水, 0);
  assert.equal(b.dominant, '木');
  assert.deepEqual(b.missing, ['火', '水']);
});
