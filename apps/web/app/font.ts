/**
 * 폰트와 wasm 조달. 라우트에서 매 요청마다 파일을 읽지 않도록 한 번만 로드한다.
 *
 * 경로로 파일을 읽으므로 Next의 파일 추적에 안 잡힌다. next.config.mjs의
 * outputFileTracingIncludes에 명시해뒀다. 여기 경로를 바꾸면 거기도 바꿀 것.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { initCardPng } from '@saju/card';

const ROOT = join(process.cwd(), '..', '..');

let fontPromise: Promise<Buffer> | undefined;
let wasmReady: Promise<void> | undefined;

export function cardFont(): Promise<Buffer> {
  fontPromise ??= readFile(join(ROOT, 'packages/card/assets/saju-subset.ttf'));
  return fontPromise;
}

export function pngReady(): Promise<void> {
  wasmReady ??= readFile(join(ROOT, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')).then((w) =>
    initCardPng(w),
  );
  return wasmReady;
}
