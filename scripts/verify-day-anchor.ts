/**
 * DAY_ANCHOR 확정 스크립트.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/verify-day-anchor.ts
 *
 * 일주 계산 전체가 상수 하나에 걸려 있다. KASI가 일진을 1차 자료로 주므로
 * 추정할 필요가 없다. 임의 날짜를 뽑아 대조하고, 전부 같은 방향으로 N칸
 * 밀려 있으면 앵커를 N만큼 옮기면 끝난다.
 *
 * 출력이 "앵커 정확" 이면 day-hour-pillar.ts의 ⚠️ 주석을 지워도 된다.
 */

import { fetchDayInfo, KasiError } from '../packages/manseryeok/src/kasi-client.ts';
import { dayPillarFromDate, DAY_ANCHOR } from '../packages/manseryeok/src/day-hour-pillar.ts';
import { ganjiName, STEMS, BRANCHES } from '../packages/manseryeok/src/types.ts';

/** 한글 간지("신축")를 60갑자 인덱스로. 한자 병기가 붙어 있어도 앞 두 글자만 본다. */
const HANGUL_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const HANGUL_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

function parseIljin(iljin: string): number {
  const s = HANGUL_STEMS.indexOf(iljin[0]);
  const b = HANGUL_BRANCHES.indexOf(iljin[1]);
  if (s < 0 || b < 0) throw new Error(`일진을 읽지 못했습니다: ${iljin}`);
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  throw new Error(`불가능한 간지: ${iljin}`);
}

/** 검증 표본. 자오선 전환·서머타임 구간·경계를 의도적으로 포함한다. */
const SAMPLE_DATES: Array<[number, number, number]> = [
  [1900, 1, 1], [1905, 6, 15], [1912, 1, 1], [1930, 7, 4],
  [1948, 6, 1], [1950, 12, 25], [1954, 3, 21], [1958, 6, 15],
  [1961, 8, 10], [1970, 1, 1], [1984, 2, 2], [1987, 5, 10],
  [1988, 9, 17], [1999, 12, 31], [2000, 2, 29], [2010, 5, 5],
  [2024, 1, 1], [2026, 8, 6],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: Array<{ date: string; kasi: string; ours: string; delta: number }> = [];
const failures: string[] = [];

for (const [y, m, d] of SAMPLE_DATES) {
  const label = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  try {
    const info = await fetchDayInfo(y, m, d);
    const expected = parseIljin(info.iljin);
    const actual = dayPillarFromDate(y, m, d);
    const delta = (((expected - actual) % 60) + 60) % 60;
    results.push({
      date: label,
      kasi: `${info.iljin}(${expected})`,
      ours: `${ganjiName(actual)}(${actual})`,
      delta,
    });
  } catch (e) {
    failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof KasiError && e.resultCode !== '00-empty') break;
  }
  await sleep(120); // 포털 호출 간격 예의
}

if (results.length === 0) {
  console.error('\n대조를 한 건도 못 했습니다.\n');
  for (const f of failures.slice(0, 3)) console.error('  ' + f);
  console.error('\nKASI 음양력 API 활용신청 승인 여부와 전파 시간을 확인하세요.');
  process.exit(1);
}

console.log('\n날짜         KASI 일진        우리 계산        차이');
console.log('─'.repeat(60));
for (const r of results) {
  const mark = r.delta === 0 ? '✔' : `✖ +${r.delta}일`;
  console.log(`${r.date}  ${r.kasi.padEnd(16)} ${r.ours.padEnd(16)} ${mark}`);
}

const deltas = new Set(results.map((r) => r.delta));
console.log('─'.repeat(60));
console.log(`대조 ${results.length}건, 실패 ${failures.length}건`);

if (deltas.size === 1 && deltas.has(0)) {
  console.log(`\n✔ 앵커 정확: ${DAY_ANCHOR.year}-${DAY_ANCHOR.month}-${DAY_ANCHOR.day} = 甲子`);
  console.log('  day-hour-pillar.ts의 미검증 경고를 지워도 됩니다.');
} else if (deltas.size === 1) {
  const [delta] = [...deltas];
  console.log(`\n✖ 앵커가 일정하게 ${delta}칸 어긋납니다.`);
  console.log(`  DAY_ANCHOR.ganji를 ${DAY_ANCHOR.ganji} → ${(DAY_ANCHOR.ganji + delta) % 60}로 고치면 전부 맞습니다.`);
  process.exit(1);
} else {
  console.log(`\n✖ 차이가 일정하지 않습니다: ${[...deltas].join(', ')}`);
  console.log('  앵커 문제가 아니라 날짜 산술이 틀렸다는 뜻입니다. 경과일수 계산을 보세요.');
  process.exit(1);
}
