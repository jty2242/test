import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodePanCode,
  decodePanCode,
  MalformedPanCode,
  InvalidPan,
} from '../src/pan-code.ts';
import type { Pan } from '../src/types.ts';

const base: Pan = { year: 14, month: 51, day: 6, hour: 51, gender: 'male', jasi: 'yaja' };

test('라운드트립 — 대표 판', () => {
  assert.deepEqual(decodePanCode(encodePanCode(base)), base);
});

test('라운드트립 — 전 범위 완전 탐색 (성별·자시·시주모름 축)', () => {
  // 년월일 60^3 전수는 과하다. 각 축의 경계와 대표값만 곱해서 돈다.
  const ganjis = [0, 1, 29, 30, 58, 59];
  const hours = [...ganjis, null];
  for (const year of ganjis)
    for (const month of ganjis)
      for (const day of ganjis)
        for (const hour of hours)
          for (const gender of ['male', 'female'] as const)
            for (const jasi of ['yaja', 'joja'] as const) {
              const pan: Pan = { year, month, day, hour, gender, jasi };
              const code = encodePanCode(pan);
              assert.equal(code.length, 5, `길이 5가 아님: ${code}`);
              assert.deepEqual(decodePanCode(code), pan, `실패: ${code}`);
            }
});

test('성별이 다르면 코드가 다르다 — 대운 순역이 갈리므로 캐시가 섞이면 안 된다', () => {
  const male = encodePanCode({ ...base, gender: 'male' });
  const female = encodePanCode({ ...base, gender: 'female' });
  assert.notEqual(male, female);
});

test('자시 정책이 다르면 코드가 다르다', () => {
  assert.notEqual(
    encodePanCode({ ...base, jasi: 'yaja' }),
    encodePanCode({ ...base, jasi: 'joja' }),
  );
});

test('시각 모름은 어떤 시주와도 겹치지 않는다', () => {
  const unknown = encodePanCode({ ...base, hour: null });
  for (let h = 0; h < 60; h++) {
    assert.notEqual(unknown, encodePanCode({ ...base, hour: h }));
  }
  assert.equal(decodePanCode(unknown).hour, null);
});

test('최댓값도 5글자에 들어간다', () => {
  const max: Pan = { year: 59, month: 59, day: 59, hour: null, gender: 'female', jasi: 'joja' };
  const code = encodePanCode(max);
  assert.equal(code.length, 5);
  assert.deepEqual(decodePanCode(code), max);
});

test('최솟값은 0으로 패딩된다', () => {
  const min: Pan = { year: 0, month: 0, day: 0, hour: 0, gender: 'male', jasi: 'yaja' };
  assert.equal(encodePanCode(min), '00000');
  assert.deepEqual(decodePanCode('00000'), min);
});

test('깨진 코드는 MalformedPanCode — 빈 화면 대신 다시 뽑기로 보내야 한다', () => {
  for (const bad of ['', '1234', '123456', 'ABCDE', '12-45', '     ', '나쁜코드']) {
    assert.throws(() => decodePanCode(bad), MalformedPanCode, `통과하면 안 됨: ${JSON.stringify(bad)}`);
  }
});

test('범위 밖 코드는 조용히 그럴듯한 판이 되지 않는다', () => {
  // zzzzz = 36^5-1 로 유효 최댓값보다 크다. 추측한 문자열이 사주판으로 둔갑하면 안 된다.
  assert.throws(() => decodePanCode('zzzzz'), MalformedPanCode);
});

test('잘못된 판은 인코딩 단계에서 거부된다', () => {
  assert.throws(() => encodePanCode({ ...base, year: 60 }), InvalidPan);
  assert.throws(() => encodePanCode({ ...base, day: -1 }), InvalidPan);
  assert.throws(() => encodePanCode({ ...base, month: 1.5 }), InvalidPan);
  assert.throws(() => encodePanCode({ ...base, gender: 'x' as never }), InvalidPan);
});
