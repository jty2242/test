import test from 'node:test';
import assert from 'node:assert/strict';

import { interpret } from '../src/interpret.ts';
import { calculate } from '../src/calculate.ts';
import { STEMS, stemOf, type Pan } from '../src/types.ts';

test('천간 10개 전부 풀이가 있다', () => {
  for (let i = 0; i < 60; i++) {
    const pan: Pan = { year: 0, month: 0, day: i, hour: 0, gender: 'male', jasi: 'yaja' };
    const r = interpret(pan);
    assert.ok(r.dayMasterTitle.startsWith(stemOf(i)), `${i}: ${r.dayMasterTitle}`);
    assert.ok(r.dayMasterText.length > 10, `${stemOf(i)} 풀이가 비었음`);
  }
  assert.equal(new Set(STEMS.map((_, i) => interpret({ year: 0, month: 0, day: i, hour: 0, gender: 'male', jasi: 'yaja' }).dayMasterText)).size, 10, '천간별 문구가 겹침');
});

test('없는 오행마다 문장이 하나씩', () => {
  const r = calculate({ year: 1998, month: 3, day: 14, hour: 7, minute: 20, gender: 'male' });
  // 戊寅 乙卯 庚申 己卯 — 火水 없음, 木 4개
  const i = interpret(r.charts[0].pan);
  assert.equal(i.absenceTexts.length, 2);
  assert.ok(i.excessText, '木 4개면 과다여야 함');
  assert.ok(i.dayMasterTitle.startsWith('庚'));
});

test('오행이 고르면 과다 문장이 없다', () => {
  // 억지로 고르게: 甲子(0) 丙寅(2) 戊辰(4) 庚午(6) → 木火土金水가 흩어짐
  const even: Pan = { year: 0, month: 2, day: 4, hour: 6, gender: 'male', jasi: 'yaja' };
  const i = interpret(even);
  assert.equal(i.excessText, null, `과다가 아닌데 문장이 나옴: ${i.excessText}`);
});

test('시각을 몰라도(6글자) 풀이가 나온다', () => {
  const r = calculate({ year: 2000, month: 5, day: 20, hour: null, gender: 'female' });
  const i = interpret(r.charts[0].pan);
  assert.ok(i.dayMasterText.length > 10);
  assert.ok(Array.isArray(i.absenceTexts));
});
