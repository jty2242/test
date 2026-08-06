import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOLAR_TERMS,
  MONTH_BOUNDARY_TERMS,
  solarTermsInYear,
  solarTerm,
  termBoundaryProximity,
  TERM_ACCURACY_MINUTES,
} from '../src/solar-terms.ts';
import { deltaT, apparentSolarLongitude, julianDayUt } from '../src/solar-position.ts';

const at = (t: { year: number; month: number; day: number; hour: number; minute: number }) =>
  `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')} ` +
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

test('절기 이름과 황경이 15도 간격으로 대응한다', () => {
  assert.equal(SOLAR_TERMS.length, 24);
  assert.equal(SOLAR_TERMS[0], '춘분', '인덱스 0 = 황경 0도');
  assert.equal(SOLAR_TERMS[21], '입춘', '입춘은 황경 315도');
  assert.equal(SOLAR_TERMS[18], '동지', '동지는 황경 270도');
  assert.equal(new Set(SOLAR_TERMS).size, 24, '중복 없음');
});

test('월을 가르는 절(節)은 12개다', () => {
  assert.equal(MONTH_BOUNDARY_TERMS.length, 12);
  // 중기(中氣)는 월을 가르지 않는다
  for (const jungki of ['우수', '춘분', '곡우', '소만', '하지', '대서']) {
    assert.ok(!MONTH_BOUNDARY_TERMS.includes(jungki as never), `${jungki}는 절이 아님`);
  }
  for (const jeol of ['입춘', '경칩', '청명', '입하']) {
    assert.ok(MONTH_BOUNDARY_TERMS.includes(jeol as never), `${jeol}은 절`);
  }
});

test('한 해에 24절기가 정확히 한 번씩 나온다', () => {
  for (const year of [1900, 1984, 2024, 2100]) {
    const terms = solarTermsInYear(year);
    assert.equal(terms.length, 24, `${year}년`);
    assert.equal(new Set(terms.map((t) => t.name)).size, 24, `${year}년 중복`);
    assert.ok(terms.every((t) => t.year === year), `${year}년 밖 절기 포함됨`);
  }
});

test('절기는 시간순으로 정렬돼 나온다', () => {
  const terms = solarTermsInYear(2024);
  for (let i = 1; i < terms.length; i++) {
    const prev = Date.UTC(terms[i - 1].year, terms[i - 1].month - 1, terms[i - 1].day, terms[i - 1].hour, terms[i - 1].minute);
    const cur = Date.UTC(terms[i].year, terms[i].month - 1, terms[i].day, terms[i].hour, terms[i].minute);
    assert.ok(cur > prev, `${terms[i].name}이 ${terms[i - 1].name}보다 앞섬`);
  }
});

test('인접 절기 간격이 물리적으로 타당하다 — 14.6~15.8일', () => {
  // 근일점(1월) 부근은 짧고 원일점(7월) 부근은 길다. 이 범위를 벗어나면
  // 해가 잘못 잡혔거나 뉴턴법이 엉뚱한 교차점으로 수렴한 것이다.
  const terms = solarTermsInYear(2024);
  for (let i = 1; i < terms.length; i++) {
    const days =
      (Date.UTC(terms[i].year, terms[i].month - 1, terms[i].day, terms[i].hour, terms[i].minute) -
        Date.UTC(terms[i - 1].year, terms[i - 1].month - 1, terms[i - 1].day, terms[i - 1].hour, terms[i - 1].minute)) /
      86400000;
    assert.ok(days > 14.4 && days < 15.9, `${terms[i - 1].name}→${terms[i].name} ${days.toFixed(2)}일`);
  }
});

test('알려진 값과 일치한다 — 2015년 하지는 KST 6/22 01:38', () => {
  // 2015년 6월 지점은 UTC 6/21 16:38로 공표된 값. KST로 +9시간.
  // (KASI 특일정보는 01:58로 되어 있고, 이건 kasi-errata.json에 등재된 오류다.)
  assert.equal(at(solarTerm(2015, '하지')), '2015-06-22 01:38');
});

test('입춘은 늘 2월 3~5일 사이에 온다', () => {
  for (const year of [1900, 1950, 1984, 2000, 2024, 2050, 2100]) {
    const ipchun = solarTerm(year, '입춘');
    assert.equal(ipchun.month, 2, `${year}년 입춘이 2월이 아님`);
    assert.ok(ipchun.day >= 3 && ipchun.day <= 5, `${year}년 입춘 ${ipchun.day}일`);
    assert.equal(ipchun.longitude, 315);
    assert.ok(ipchun.isMonthBoundary);
  }
});

test('계산한 절기 시각에 태양 황경이 실제로 목표값이다 — 자기 일관성', () => {
  for (const name of ['입춘', '하지', '동지'] as const) {
    const t = solarTerm(2024, name);
    // KST 벽시계 → UT → TT
    const jdUt = julianDayUt(t.year, t.month, t.day + (t.hour * 60 + t.minute) / 1440) - 9 / 24;
    const jde = jdUt + deltaT(t.year, t.month) / 86400;
    const lon = apparentSolarLongitude(jde);
    const diff = ((((lon - t.longitude) % 360) + 540) % 360) - 180;
    // 분 단위로 반올림했으므로 최대 30초 ≈ 0.0082도 어긋날 수 있다
    assert.ok(Math.abs(diff) < 0.01, `${name}: 황경 오차 ${(diff * 3600).toFixed(1)}초각`);
  }
});

// ── 경계 근접 판정 ───────────────────────────────────────────────────────

test('절기 순간 자체는 모호 구간이다', () => {
  const ipchun = solarTerm(2024, '입춘');
  const p = termBoundaryProximity(ipchun.year, ipchun.month, ipchun.day, ipchun.hour, ipchun.minute);
  assert.equal(p.isAmbiguous, true);
  assert.equal(p.nearest.name, '입춘');
  assert.equal(p.minutesFromTerm, 0);
});

test('경계에서 충분히 떨어지면 모호하지 않다', () => {
  const ipchun = solarTerm(2024, '입춘');
  const later = new Date(
    Date.UTC(ipchun.year, ipchun.month - 1, ipchun.day, ipchun.hour, ipchun.minute + 30),
  );
  const p = termBoundaryProximity(
    later.getUTCFullYear(),
    later.getUTCMonth() + 1,
    later.getUTCDate(),
    later.getUTCHours(),
    later.getUTCMinutes(),
  );
  assert.equal(p.isAmbiguous, false);
  assert.equal(p.minutesFromTerm, 30);
});

test('모호 판정 폭이 공표 오차 한계와 같다', () => {
  const ipchun = solarTerm(2024, '입춘');
  const shift = (mins: number) => {
    const d = new Date(Date.UTC(ipchun.year, ipchun.month - 1, ipchun.day, ipchun.hour, ipchun.minute + mins));
    return termBoundaryProximity(
      d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(),
    ).isAmbiguous;
  };
  assert.equal(shift(TERM_ACCURACY_MINUTES), true, '한계값은 포함');
  assert.equal(shift(-TERM_ACCURACY_MINUTES), true, '음수 방향도 포함');
  assert.equal(shift(TERM_ACCURACY_MINUTES + 1), false, '한계 밖');
});

test('연말·연초 출생은 이웃 해의 절기와도 비교한다', () => {
  // 1월 1일생은 그 해 소한(1/5~6)보다 전해 동지(12/21~22)가 가까울 수 있다.
  const p = termBoundaryProximity(2024, 1, 1, 12, 0);
  assert.ok(['동지', '소한'].includes(p.nearest.name), `가장 가까운 절기: ${p.nearest.name}`);
  assert.ok(Math.abs(p.minutesFromTerm) < 12 * 1440, '11일 이상 떨어질 수 없음');
});
