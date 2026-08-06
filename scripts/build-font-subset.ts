/**
 * 카드용 폰트 서브셋 생성.
 *
 *   node --experimental-strip-types scripts/build-font-subset.ts
 *
 * 원본(10MB)은 저장소에 안 넣는다. 없으면 받아온다. 산출물인 서브셋 17KB만
 * 커밋한다. OFL은 파생물 배포 시 라이선스 동봉을 요구하므로 OFL.txt도 같이 받는다.
 *
 * 문자 집합은 카드 코드가 정한다(`cardCharset`). 여기서 따로 목록을 들고 있으면
 * 카드 문구를 바꿨을 때 서브셋이 뒤처지고, satori는 없는 글리프를 조용히 빼버려서
 * 아무도 눈치채지 못한다. 출처를 하나로 둔다.
 *
 * 집합이 닫혀 있는 이유: 이름은 서버로 오지 않고(이슈 3A) 나머지는 60갑자와
 * 고정 문구뿐이다. 그래서 10MB가 17KB로 줄고 엣지 함수 크기가 문제가 안 된다.
 *
 * ⚠️ 가변 폰트를 그대로 서브셋하면 satori가 못 읽는다("Cannot read properties of
 *    undefined"). wght 축을 400으로 고정해 정적 인스턴스로 만들어야 한다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import subsetFont from 'subset-font';

import { cardCharset, ILJU_NAMES } from '../packages/card/src/card.ts';

/** Noto Sans KR (SIL Open Font License 1.1). 한글 + 한국 한자 포함. */
const FONT_URL =
  'https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf';
const LICENSE_URL = 'https://github.com/google/fonts/raw/main/ofl/notosanskr/OFL.txt';

const CACHE_DIR = '.font-cache';
const CACHED_SOURCE = join(CACHE_DIR, 'NotoSansKR.ttf');
const ASSETS = 'packages/card/assets';
const OUT = join(ASSETS, 'saju-subset.ttf');
const LICENSE_OUT = join(ASSETS, 'OFL.txt');
/** 서브셋을 모듈로도 낸다. 배포 환경마다 다른 파일 경로를 안 겪으려고. */
const MODULE_OUT = 'packages/card/src/font-data.ts';

async function download(url: string, to: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`폰트 내려받기 실패 ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, buf);
  return buf;
}

const source = process.env.FONT_SOURCE
  ? readFileSync(process.env.FONT_SOURCE)
  : existsSync(CACHED_SOURCE)
    ? readFileSync(CACHED_SOURCE)
    : await download(FONT_URL, CACHED_SOURCE);

if (!existsSync(LICENSE_OUT)) {
  mkdirSync(ASSETS, { recursive: true });
  await download(LICENSE_URL, LICENSE_OUT);
}

const text = cardCharset(ILJU_NAMES);
const subset = await subsetFont(source, text, {
  targetFormat: 'truetype',
  // 가변 축을 고정하지 않으면 satori가 못 읽는다
  variationAxes: { wght: 400 },
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, subset);

// 17KB짜리를 파일로 읽으면 번들러·서버리스마다 경로 문제를 겪는다. 모듈로 박으면
// 그 문제가 통째로 사라진다. base64라 약 33% 커지지만 23KB는 무시할 수 있다.
writeFileSync(
  MODULE_OUT,
  `/* 자동 생성 — scripts/build-font-subset.ts. 직접 고치지 말 것. */
` +
    `/* Noto Sans KR 서브셋 (SIL OFL 1.1, packages/card/assets/OFL.txt) */
` +
    `export const FONT_BASE64 =
  '${subset.toString('base64')}';

` +
    `export const cardFontData: Uint8Array = Uint8Array.from(
` +
    `  Buffer.from(FONT_BASE64, 'base64'),
);
`,
);

console.log(`글자 ${text.length}개`);
console.log(`원본    ${(source.length / 1048576).toFixed(1)} MB`);
console.log(`${OUT}  ${(subset.length / 1024).toFixed(1)} KB  (${Math.round(source.length / subset.length)}배 축소)`);
console.log(`${MODULE_OUT}  ${(subset.toString('base64').length / 1024).toFixed(1)} KB (base64)`);
console.log(`라이선스 ${LICENSE_OUT}`);
