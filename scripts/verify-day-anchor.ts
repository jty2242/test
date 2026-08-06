/**
 * DAY_ANCHOR 재확인 스크립트.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/verify-day-anchor.ts
 *
 * 일주 계산 전체가 상수 하나에 걸려 있다. KASI가 일진을 1차 자료로 주므로
 * 추정할 필요가 없다.
 *
 * getSpcifyLunCalInfo는 음력 월/일 하나에 대해 연도 범위를 받아 매년의 양력
 * 날짜와 일진을 한 번에 돌려준다. 호출 한 번에 100건 넘는 대조 표본이 나온다.
 * (getSolCalInfo / getLunCalInfo는 같은 키로도 0건을 반환한다 — 원인 불명.)
 *
 * 두 경로를 함께 검증한다:
 *   경과일수 경로  dayPillarFromDate  — 앵커에서 며칠 지났나
 *   JDN 경로       dayPillarFromJdn   — (율리우스적일 + 49) % 60
 * 둘은 공유 코드가 없다. 셋(KASI 포함)이 다 맞아야 통과다.
 */

import {
  DAY_ANCHOR,
  dayPillarFromDate,
  dayPillarFromJdn,
  julianDayNumber,
} from '../packages/manseryeok/src/day-hour-pillar.ts';
import { ganjiName } from '../packages/manseryeok/src/types.ts';

const HANGUL_STEMS = '갑을병정무기경신임계';
const HANGUL_BRANCHES = '자축인묘진사오미신유술해';

/** "병인(丙寅)" 또는 "병인" → 60갑자 인덱스 */
function parseIljin(iljin: string): number {
  const s = HANGUL_STEMS.indexOf(iljin[0]);
  const b = HANGUL_BRANCHES.indexOf(iljin[1]);
  if (s < 0 || b < 0) throw new Error(`일진을 읽지 못했습니다: ${iljin}`);
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  throw new Error(`불가능한 간지: ${iljin}`);
}

const key = process.env.KASI_SERVICE_KEY;
if (!key) {
  console.error('KASI_SERVICE_KEY가 없습니다. node --env-file=.env.local 로 실행하세요.');
  process.exit(1);
}

const FROM = 1900;
const TO = 2026;

/** 음력 월/일을 여러 개 돌려 표본을 늘린다. 각 호출이 연도 수만큼 행을 준다. */
const LUNAR_PROBES: Array<[number, number]> = [
  [1, 1],
  [5, 5],
  [8, 15],
];

const tag = (s: string, n: string) => s.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1] ?? null;

interface Row {
  date: string;
  kasi: number;
  elapsed: number;
  jdn: number;
  jdMatch: boolean;
}

const rows: Row[] = [];

for (const [lunMonth, lunDay] of LUNAR_PROBES) {
  const url =
    'http://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getSpcifyLunCalInfo' +
    `?serviceKey=${key}&fromSolYear=${FROM}&toSolYear=${TO}` +
    `&lunMonth=${String(lunMonth).padStart(2, '0')}&lunDay=${String(lunDay).padStart(2, '0')}` +
    `&leapMonth=${encodeURIComponent('평')}&numOfRows=300`;

  const res = await fetch(url);
  const xml = await res.text();
  const code = tag(xml, 'resultCode') ?? tag(xml, 'returnReasonCode');

  if (res.status !== 200 || code !== '00') {
    console.error(`KASI 요청 실패 (음력 ${lunMonth}/${lunDay}): ${res.status} code=${code}`);
    console.error(tag(xml, 'resultMsg') ?? tag(xml, 'returnAuthMsg') ?? '');
    process.exit(1);
  }

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const y = Number(tag(item, 'solYear'));
    const mo = Number(tag(item, 'solMonth'));
    const d = Number(tag(item, 'solDay'));
    const iljin = tag(item, 'lunIljin');
    const solJd = Number(tag(item, 'solJd'));
    if (!iljin || !y) continue;

    rows.push({
      date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      kasi: parseIljin(iljin),
      elapsed: dayPillarFromDate(y, mo, d),
      jdn: dayPillarFromJdn(y, mo, d),
      jdMatch: julianDayNumber(y, mo, d) === solJd,
    });
  }
}

if (rows.length === 0) {
  console.error('대조 표본이 없습니다. API 승인 상태를 확인하세요.');
  process.exit(1);
}

const deltas = new Map<number, number>();
for (const r of rows) {
  const delta = (((r.kasi - r.elapsed) % 60) + 60) % 60;
  deltas.set(delta, (deltas.get(delta) ?? 0) + 1);
}

const pathMismatch = rows.filter((r) => r.elapsed !== r.jdn);
const jdMismatch = rows.filter((r) => !r.jdMatch);

console.log(`\n표본 ${rows.length}건 (${FROM}~${TO}, 음력 ${LUNAR_PROBES.map(([m, d]) => `${m}/${d}`).join(', ')})`);
console.log(`앵커: ${DAY_ANCHOR.year}-${DAY_ANCHOR.month}-${DAY_ANCHOR.day} = ${ganjiName(DAY_ANCHOR.ganji)}(${DAY_ANCHOR.ganji})`);
console.log('─'.repeat(56));
console.log(`경과일수 경로 vs JDN 경로 불일치 : ${pathMismatch.length}건`);
console.log(`계산한 JDN vs KASI solJd 불일치  : ${jdMismatch.length}건`);
console.log(`KASI 일진 대비 델타 분포         : ${[...deltas.entries()].map(([k, v]) => `+${k}: ${v}건`).join(', ')}`);
console.log('─'.repeat(56));

let failed = false;

if (pathMismatch.length > 0) {
  console.log(`\n✖ 두 계산 경로가 갈립니다 (예: ${pathMismatch[0].date}). 산술 버그입니다.`);
  failed = true;
}
if (jdMismatch.length > 0) {
  console.log(`\n✖ JDN 계산이 KASI solJd와 다릅니다 (예: ${jdMismatch[0].date}).`);
  failed = true;
}

if (deltas.size === 1 && deltas.has(0)) {
  console.log('\n✔ 앵커 정확. 세 경로(KASI 일진 · 경과일수 · JDN)가 전부 일치합니다.');
} else if (deltas.size === 1) {
  const [delta] = [...deltas.keys()];
  console.log(`\n✖ 앵커가 일정하게 ${delta}칸 어긋납니다.`);
  console.log(`  DAY_ANCHOR.ganji: ${DAY_ANCHOR.ganji} → ${(DAY_ANCHOR.ganji + delta) % 60}`);
  failed = true;
} else {
  console.log(`\n✖ 델타가 일정하지 않습니다: ${[...deltas.keys()].join(', ')}`);
  console.log('  앵커 문제가 아니라 날짜 산술이 틀렸다는 뜻입니다.');
  failed = true;
}

process.exit(failed ? 1 : 0);
