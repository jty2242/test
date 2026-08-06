import test from 'node:test';
import assert from 'node:assert/strict';

import { isDst, meridianFor, standardOffsetMinutes, offsetAtUtc, koreaTimeContext } from '../src/timezone.ts';
import { toTrueSolarTime, equationOfTime, SEOUL_LONGITUDE } from '../src/true-solar-time.ts';

test('자오선 역사 — 1954~1961은 127.5°E였다', () => {
  assert.equal(meridianFor(1930, 5, 1), 135, '일제강점기는 135°E');
  assert.equal(meridianFor(1954, 3, 20), 135, '전환 전날은 아직 135°E');
  assert.equal(meridianFor(1954, 3, 21), 127.5, '전환일부터 127.5°E');
  assert.equal(meridianFor(1958, 6, 15), 127.5);
  assert.equal(meridianFor(1961, 8, 9), 127.5, '전환 전날은 아직 127.5°E');
  assert.equal(meridianFor(1961, 8, 10), 135, '전환일부터 135°E');
  assert.equal(meridianFor(1998, 3, 14), 135, '현재');
});

test('1954~1961 출생자는 경도 보정이 거의 0이다', () => {
  // 이 구간을 일괄 -32분으로 처리하면 8년치가 통째로 틀린다.
  const r = toTrueSolarTime({ year: 1958, month: 3, day: 15, hour: 12, minute: 0 });
  assert.equal(r.breakdown.longitude, -2.1);
  assert.ok(Math.abs(r.offsetMinutes) <= 3, `보정이 과함: ${r.offsetMinutes}분`);
});

test('현행 135°E 기준은 약 -32분', () => {
  const r = toTrueSolarTime({ year: 1998, month: 3, day: 14, hour: 7, minute: 20 });
  assert.equal(r.breakdown.longitude, -32.1);
  assert.equal(r.offsetMinutes, -32);
  assert.equal(r.hour, 6);
  assert.equal(r.minute, 48);
});

test('서머타임 구간', () => {
  assert.equal(isDst(1958, 5, 3), false, '시행 전날');
  assert.equal(isDst(1958, 5, 4), true, '시행일');
  assert.equal(isDst(1958, 9, 20), true, '해제 전날');
  assert.equal(isDst(1958, 9, 21), false, '해제일');
  assert.equal(isDst(1988, 8, 1), true, '올림픽 해');
  assert.equal(isDst(1989, 8, 1), false, '이후로는 없음');
  assert.equal(isDst(1998, 6, 1), false);
});

test('서머타임 + 127.5°E가 겹치는 구간 — 적대적 QA 케이스', () => {
  // 1958-06-15는 서머타임 시행 중이면서 자오선이 127.5°E인 구간.
  // 두 보정을 다 놓치면 한 시간 넘게 어긋난다.
  const r = toTrueSolarTime({ year: 1958, month: 6, day: 15, hour: 23, minute: 45 });
  assert.equal(r.breakdown.dst, -60);
  assert.equal(r.breakdown.longitude, -2.1);
  assert.equal(r.offsetMinutes, -62);
  assert.equal(r.hour, 22);
  assert.equal(r.minute, 43);
  assert.equal(r.day, 15, '날짜는 안 넘어감');
});

test('보정이 자정을 넘기면 날짜가 전날로 간다', () => {
  const r = toTrueSolarTime({ year: 1998, month: 3, day: 14, hour: 0, minute: 10 });
  assert.equal(r.offsetMinutes, -32);
  assert.equal(r.day, 13, '전날로 넘어가야 함');
  assert.equal(r.hour, 23);
  assert.equal(r.minute, 38);
});

test('월초·윤년 경계에서도 날짜 연산이 깨지지 않는다', () => {
  const march1 = toTrueSolarTime({ year: 2000, month: 3, day: 1, hour: 0, minute: 5 });
  assert.deepEqual(
    [march1.year, march1.month, march1.day],
    [2000, 2, 29],
    '2000년은 윤년이라 2/29로 가야 함',
  );

  const jan1 = toTrueSolarTime({ year: 1999, month: 1, day: 1, hour: 0, minute: 5 });
  assert.deepEqual([jan1.year, jan1.month, jan1.day], [1998, 12, 31], '해를 넘어감');
});

test('균시차는 기본 off — 국내 만세력 관행', () => {
  const off = toTrueSolarTime({ year: 1998, month: 11, day: 3, hour: 12, minute: 0 });
  assert.equal(off.breakdown.equationOfTime, 0);

  const on = toTrueSolarTime(
    { year: 1998, month: 11, day: 3, hour: 12, minute: 0 },
    { useEquationOfTime: true },
  );
  assert.notEqual(on.breakdown.equationOfTime, 0);
  assert.notEqual(on.offsetMinutes, off.offsetMinutes);
});

test('균시차 근사식이 알려진 범위 안에 있다', () => {
  // 연중 최대 약 +16분(11월 초), 최소 약 -14분(2월 중순)
  let min = Infinity;
  let max = -Infinity;
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const e = equationOfTime(1998, m, d);
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
  }
  assert.ok(max > 14 && max < 18, `최댓값이 범위 밖: ${max}`);
  assert.ok(min < -12 && min > -17, `최솟값이 범위 밖: ${min}`);
});

test('경도를 바꾸면 보정도 따라 바뀐다 — 출생지 입력을 나중에 붙일 자리', () => {
  const seoul = toTrueSolarTime({ year: 1998, month: 3, day: 14, hour: 12, minute: 0 });
  const busan = toTrueSolarTime(
    { year: 1998, month: 3, day: 14, hour: 12, minute: 0 },
    { longitude: 129.075 },
  );
  assert.ok(busan.offsetMinutes > seoul.offsetMinutes, '부산이 동쪽이라 덜 당겨짐');
  assert.equal(SEOUL_LONGITUDE, 126.978);
});

test('tzdata 전환표가 예상과 일치한다 — Node 업그레이드로 바뀌면 여기서 잡힌다', () => {
  // 오프셋이 바뀌는 순간을 전부 스캔한다. 한국은 1908~1988에 28번 바뀌었다.
  const transitions: number[] = [];
  let prev = offsetAtUtc(Date.UTC(1908, 0, 1));
  for (let t = Date.UTC(1908, 0, 1); t < Date.UTC(1990, 0, 1); t += 3600000) {
    const o = offsetAtUtc(t);
    if (o !== prev) transitions.push(o);
    prev = o;
  }
  assert.equal(transitions.length, 28, '전환 횟수가 달라짐 — tzdata가 바뀌었는지 확인');

  // 관측 가능한 오프셋은 이 다섯 가지뿐. 다른 값이 나오면 기저/서머타임 분리가 깨진다.
  const seen = new Set<number>();
  for (let t = Date.UTC(1900, 0, 1); t < Date.UTC(2030, 0, 1); t += 6 * 3600000) {
    seen.add(offsetAtUtc(t));
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [507, 510, 540, 570, 600]);
});

test('서머타임 전환은 자정이 아니다 — 날짜 단위 판정으로는 놓친다', () => {
  // 1958년 해제는 서머타임 기준 09-21 00:30. 같은 날짜 안에서 상태가 갈린다.
  assert.equal(isDst(1958, 9, 20, 20, 0), true, '해제일 전날 저녁은 서머타임');
  assert.equal(isDst(1958, 9, 21, 5, 0), false, '해제 후');

  // 1988년 해제는 10-09 03:00. 같은 날 01시와 04시가 다르다.
  assert.equal(isDst(1988, 10, 9, 1, 0), true);
  assert.equal(isDst(1988, 10, 9, 4, 0), false);

  // 시행일도 마찬가지 — 1988-05-08 02:00에 시계가 03:00으로 건너뛴다.
  assert.equal(isDst(1988, 5, 8, 1, 0), false, '시행 전');
  assert.equal(isDst(1988, 5, 8, 5, 0), true, '시행 후');
});

test('서머타임 해제로 되풀이되는 한 시간은 표준시로 해석한다', () => {
  // 해제 시 시계가 되돌아가면서 같은 벽시계 값이 두 번 지나간다.
  // 1958-09-21 00:00은 서머타임 중에 한 번, 되돌아온 뒤 표준시로 또 한 번.
  // 어느 쪽인지 입력만으로는 알 수 없다. 표준시 쪽으로 고정한다 — 역사상
  // 12일에만 해당하고, 그 경계는 교차검증에서 손으로 확정한다.
  assert.equal(isDst(1958, 9, 21, 0, 0), false, '모호한 시각 → 표준시');
  assert.equal(isDst(1988, 10, 9, 2, 30), false, '모호한 시각 → 표준시');
});

test('기저 오프셋과 서머타임이 정확히 갈라진다', () => {
  const dstIn5030 = koreaTimeContext(1958, 6, 15, 12, 0);
  assert.equal(dstIn5030.offsetMinutes, 570, '+9:30 = +8:30 기저 + 서머타임');
  assert.equal(dstIn5030.baseOffsetMinutes, 510);
  assert.equal(dstIn5030.isDst, true);
  assert.equal(dstIn5030.meridianDeg, 127.5);

  const dstIn9 = koreaTimeContext(1988, 8, 1, 12, 0);
  assert.equal(dstIn9.offsetMinutes, 600, '+10:00 = +9:00 기저 + 서머타임');
  assert.equal(dstIn9.baseOffsetMinutes, 540);
  assert.equal(dstIn9.meridianDeg, 135);
});

test('표준시 제정 이전(1900~1908)도 자오선이 나온다', () => {
  const ctx = koreaTimeContext(1905, 6, 1, 12, 0);
  assert.equal(ctx.offsetMinutes, 507, '지방시 +8:27');
  assert.equal(ctx.meridianDeg, 126.75, '기저 오프셋 ÷ 4');
  // 지방시라 경도 보정이 거의 없다
  const r = toTrueSolarTime({ year: 1905, month: 6, day: 1, hour: 12, minute: 0 });
  assert.ok(Math.abs(r.offsetMinutes) <= 2, `보정이 과함: ${r.offsetMinutes}분`);
});

test('표준시 오프셋 참고값', () => {
  assert.equal(standardOffsetMinutes(1998, 3, 14), 540, '현행 UTC+9');
  assert.equal(standardOffsetMinutes(1958, 3, 15), 510, '1954~1961 UTC+8:30');
  assert.equal(standardOffsetMinutes(1958, 6, 15), 570, '위 구간 + 서머타임');
});
