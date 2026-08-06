/**
 * KASI 24절기 수집 — 검증 세트 구축.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/fetch-solar-terms.ts
 *
 * KASI 특일정보 API는 2000~2028년만 제공한다(확인: 1999년 0건, 2029년 0건).
 * 즉 이걸로 1900~2100 테이블을 만들 수는 없다. 대신 696건의 분 단위 정답을
 * 얻는다 — 절기를 계산으로 구하는 구현을 검증하기에 충분한 표본이다.
 *
 * 연 단위 조회가 되므로 호출은 29회면 끝난다(월 단위였으면 348회).
 * 이미 받은 연도는 건너뛴다. 중단해도 다시 돌리면 이어서 받는다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'packages/manseryeok/data/kasi-solar-terms.json';
const FROM = 2000;
const TO = 2028;
const ENDPOINT =
  'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/get24DivisionsInfo';

export interface SolarTermRecord {
  /** 절기명. 예: "입춘" */
  name: string;
  /** "YYYY-MM-DD" (KST) */
  date: string;
  /** "HH:MM" 절입 시각 (KST) */
  time: string;
  /** 태양황경 (도). 입춘=315, 우수=330, ... */
  sunLongitude: number;
}

const key = process.env.KASI_SERVICE_KEY;
if (!key) {
  console.error('KASI_SERVICE_KEY가 없습니다. node --env-file=.env.local 로 실행하세요.');
  process.exit(1);
}

const tag = (s: string, n: string) => s.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1]?.trim() ?? null;

// 기존 결과를 읽어 이어받는다
let terms: SolarTermRecord[] = [];
if (existsSync(OUT)) {
  terms = JSON.parse(readFileSync(OUT, 'utf8'));
  console.log(`기존 ${terms.length}건 로드`);
}
const haveYears = new Set(terms.map((t) => Number(t.date.slice(0, 4))));

for (let year = FROM; year <= TO; year++) {
  if (haveYears.has(year)) {
    process.stdout.write(`${year} 건너뜀  `);
    continue;
  }

  const res = await fetch(`${ENDPOINT}?serviceKey=${key}&solYear=${year}&numOfRows=50`);
  const xml = await res.text();
  const code = tag(xml, 'resultCode') ?? tag(xml, 'returnReasonCode');

  if (res.status !== 200 || code !== '00') {
    console.error(`\n${year} 실패: ${res.status} code=${code} ${tag(xml, 'resultMsg') ?? ''}`);
    break;
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (items.length === 0) {
    console.error(`\n${year} 0건 — API 지원 범위 밖으로 보입니다. 중단합니다.`);
    break;
  }

  for (const item of items) {
    const locdate = tag(item, 'locdate');
    const kst = tag(item, 'kst');
    const name = tag(item, 'dateName');
    if (!locdate || !kst || !name) continue;

    terms.push({
      name,
      date: `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`,
      time: `${kst.slice(0, 2)}:${kst.slice(2, 4)}`,
      sunLongitude: Number(tag(item, 'sunLongitude')),
    });
  }

  process.stdout.write(`${year}:${items.length}  `);
  await new Promise((r) => setTimeout(r, 150));
}

terms.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(terms, null, 0) + '\n');

const years = new Set(terms.map((t) => t.date.slice(0, 4)));
const names = new Set(terms.map((t) => t.name));
console.log(`\n\n저장: ${OUT}`);
console.log(`${terms.length}건, ${years.size}개 연도, 절기 ${names.size}종`);
console.log(`범위: ${terms[0]?.date} ~ ${terms.at(-1)?.date}`);

// 온전성 검사 — 연도마다 24개, 황경이 15도 간격이어야 한다
const perYear = new Map<string, number>();
for (const t of terms) perYear.set(t.date.slice(0, 4), (perYear.get(t.date.slice(0, 4)) ?? 0) + 1);
const bad = [...perYear.entries()].filter(([, c]) => c !== 24);
console.log(bad.length === 0 ? '✔ 모든 연도가 24건' : `✖ 24건이 아닌 연도: ${bad.map(([y, c]) => `${y}(${c})`).join(', ')}`);

const longitudes = [...new Set(terms.map((t) => t.sunLongitude))].sort((a, b) => a - b);
const expected = Array.from({ length: 24 }, (_, i) => i * 15);
console.log(
  JSON.stringify(longitudes) === JSON.stringify(expected)
    ? '✔ 태양황경이 0~345도 15도 간격'
    : `✖ 황경 이상: ${longitudes.join(',')}`,
);
