/**
 * 절기 계산 검증 — KASI 696건 대조.
 *
 *   node --experimental-strip-types scripts/verify-solar-terms.ts
 *
 * 네트워크를 안 탄다. 수집해둔 JSON과만 비교하므로 회귀 테스트로 쓸 수 있다.
 *
 * 판정 기준:
 *   0분      정확히 일치
 *   ±1분     허용. 우리 오차 ±30초가 KASI의 분 반올림 경계를 넘나드는 것.
 *            이 구간은 TERM_ACCURACY_MINUTES로 제품에 드러낸다.
 *   그 외    실패. 단, kasi-errata.json에 등재된 KASI 기록 오류는 제외한다.
 */

import { readFileSync } from 'node:fs';
import { solarTermsInYear, TERM_ACCURACY_MINUTES } from '../packages/manseryeok/src/solar-terms.ts';

interface KasiTerm {
  name: string;
  date: string;
  time: string;
  sunLongitude: number;
}

interface Erratum {
  date: string;
  name: string;
  kasi: string;
  computed: string;
  deltaMinutes: number;
  confidence: string;
  reason: string;
}

const kasi: KasiTerm[] = JSON.parse(
  readFileSync('packages/manseryeok/data/kasi-solar-terms.json', 'utf8'),
);
const errata: Erratum[] = JSON.parse(
  readFileSync('packages/manseryeok/data/kasi-errata.json', 'utf8'),
).entries;

const errataKeys = new Set(errata.map((e) => `${e.date}|${e.name}`));

const years = [...new Set(kasi.map((t) => Number(t.date.slice(0, 4))))].sort();
const mine = new Map<string, { date: string; time: string }>();
for (const year of years) {
  for (const t of solarTermsInYear(year)) {
    mine.set(`${year}|${t.name}`, {
      date: `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`,
      time: `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`,
    });
  }
}

const minutesOf = (date: string, time: string) =>
  Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(time.slice(0, 2)),
    Number(time.slice(3, 5)),
  ) / 60000;

let exact = 0;
let withinTolerance = 0;
let skippedErrata = 0;
const failures: string[] = [];

for (const k of kasi) {
  const key = `${k.date}|${k.name}`;
  const m = mine.get(`${k.date.slice(0, 4)}|${k.name}`);

  if (!m) {
    failures.push(`${key} — 계산 결과에 없음`);
    continue;
  }

  const delta = minutesOf(m.date, m.time) - minutesOf(k.date, k.time);

  if (errataKeys.has(key)) {
    const e = errata.find((x) => `${x.date}|${x.name}` === key)!;
    if (delta !== e.deltaMinutes) {
      failures.push(
        `${key} — 정오표는 ${e.deltaMinutes}분을 예상했는데 ${delta}분. 계산이 바뀌었으면 정오표를 갱신하세요.`,
      );
    } else {
      skippedErrata++;
    }
    continue;
  }

  if (delta === 0) exact++;
  else if (Math.abs(delta) <= 1) withinTolerance++;
  else failures.push(`${key} — KASI=${k.date} ${k.time}  계산=${m.date} ${m.time}  ${delta}분`);
}

const checked = kasi.length - skippedErrata;

console.log(`\nKASI 표본 ${kasi.length}건 (${years[0]}~${years.at(-1)})`);
console.log('─'.repeat(60));
console.log(`정확히 일치          : ${exact}건 (${((exact / checked) * 100).toFixed(1)}%)`);
console.log(`±1분 이내            : ${withinTolerance}건`);
console.log(`KASI 오류로 제외     : ${skippedErrata}건 (kasi-errata.json)`);
console.log(`허용 범위 밖         : ${failures.length}건`);
console.log('─'.repeat(60));

if (failures.length > 0) {
  for (const f of failures.slice(0, 10)) console.log(`  ✖ ${f}`);
  if (failures.length > 10) console.log(`  … 외 ${failures.length - 10}건`);
  process.exit(1);
}

console.log(`✔ 전건 ±1분 이내. 제품 공표 오차 한계: ±${TERM_ACCURACY_MINUTES}분`);
console.log('  경계 ±2분 출생은 두 판을 병기합니다.');
