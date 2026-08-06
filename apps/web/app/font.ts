/**
 * 렌더에 필요한 자원 조달.
 *
 * 폰트는 파일이 아니라 **모듈**이다(`cardFontData`). 17KB짜리를 파일로 읽으면
 * 배포 환경마다 cwd와 파일 추적이 달라 "로컬에선 되는데 배포하면 없다"를 겪는다.
 * base64로 23KB 늘어나는 대신 그 문제 전체가 사라진다.
 *
 * wasm은 1.2MB라 인라인이 부담스러워 파일로 둔다. 그런데 위치를 찾는 방법이
 * 만만치 않다:
 *
 *   ⚠️ `require.resolve`는 쓸 수 없다. webpack이 그 호출을 자기 모듈 시스템으로
 *      바꿔치기해서 경로 대신 **숫자 모듈 ID**를 돌려준다. `createRequire`로
 *      만든 것에 다른 이름을 붙여도 마찬가지다. dev에서는 멀쩡하고 프로덕션
 *      빌드에서만 "path must be of type string. Received type number" 로 깨진다.
 *
 * 그래서 경로를 직접 조립한다. 배포 레이아웃마다 cwd가 다를 수 있으므로 후보를
 * 순서대로 시도하고, 전부 실패하면 **무엇을 찾았는지 말하는** 에러를 낸다.
 * 조용히 폴백 이미지로 넘어가면 왜 카드가 안 나오는지 영원히 모른다.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { initCardPng, cardFontData } from '@saju/card';

const WASM_RELATIVE = join('node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');

/** cwd가 앱 루트일 수도, 저장소 루트일 수도 있다. 둘 다 본다. */
const WASM_CANDIDATES = [
  join(process.cwd(), WASM_RELATIVE),
  join(process.cwd(), '..', '..', WASM_RELATIVE),
];

let wasmReady: Promise<void> | undefined;

export function cardFont(): Uint8Array {
  return cardFontData;
}

async function loadWasm(): Promise<Buffer> {
  const tried: string[] = [];
  for (const path of WASM_CANDIDATES) {
    try {
      return await readFile(path);
    } catch {
      tried.push(path);
    }
  }
  throw new Error(
    `resvg wasm을 찾지 못했습니다. cwd=${process.cwd()} 에서 시도한 경로:\n  ${tried.join('\n  ')}\n` +
      'next.config.mjs의 outputFileTracingIncludes에 wasm이 들어 있는지 확인하세요.',
  );
}

export function pngReady(): Promise<void> {
  wasmReady ??= loadWasm()
    .then((w) => initCardPng(w))
    .catch((e) => {
      // 실패를 캐시하면 이후 요청이 전부 "초기화됨"으로 오해한다
      wasmReady = undefined;
      throw e;
    });
  return wasmReady;
}
