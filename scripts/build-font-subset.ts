/**
 * 카드용 폰트 서브셋 생성.
 *
 *   node --experimental-strip-types scripts/build-font-subset.ts
 *
 * 문자 집합은 카드 코드가 정한다(`cardCharset`). 여기서 따로 목록을 들고
 * 있으면 카드 문구를 바꿨을 때 서브셋이 뒤처지고, satori는 없는 글리프를
 * 조용히 빼버려서 아무도 눈치채지 못한다. 출처를 하나로 둔다.
 *
 * 집합이 닫혀 있는 이유: 이름은 서버로 오지 않고(이슈 3A) 나머지는 60갑자와
 * 고정 문구뿐이다. 덕분에 13MB 폰트가 30KB대로 줄어 엣지 함수 크기 제한을
 * 걱정할 일이 없다.
 *
 * ⚠️ 지금 소스는 Windows의 Malgun Gothic이다. 마이크로소프트 폰트라 웹 임베딩
 *    라이선스가 없다. 배포 전에 OFL 폰트로 교체할 것. 한자까지 필요하므로
 *    Noto Sans KR 계열이 후보다 (Pretendard는 한자 미포함).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import subsetFont from 'subset-font';

import { cardCharset, ILJU_NAMES } from '../packages/card/src/card.ts';

const SOURCE = process.env.FONT_SOURCE ?? 'C:/Windows/Fonts/malgun.ttf';
const OUT = 'packages/card/assets/saju-subset.ttf';

// 별명 목록은 카드 패키지가 들고 있다. 서브셋과 런타임 가드가 같은 것을 본다.
const text = cardCharset(ILJU_NAMES);
const src = readFileSync(SOURCE);
const subset = await subsetFont(src, text, { targetFormat: 'truetype' });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, subset);

console.log(`글자 ${text.length}개`);
console.log(`${SOURCE}  ${(src.length / 1048576).toFixed(1)} MB`);
console.log(`${OUT}  ${(subset.length / 1024).toFixed(1)} KB  (${Math.round(src.length / subset.length)}배 축소)`);
