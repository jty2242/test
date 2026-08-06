/**
 * SVG → PNG. satori는 SVG까지만 만들고, OG 이미지는 PNG여야 한다.
 *
 * resvg의 **wasm** 판을 쓴다. 네이티브 바인딩(@resvg/resvg-js)이 로컬에서는
 * 더 빠르지만 엣지 런타임에서 안 돈다. 로컬에서 되는 걸 배포해서 깨지는 것보다
 * 처음부터 배포되는 물건으로 맞추는 게 낫다.
 *
 * wasm 초기화는 프로세스당 한 번이다. 엣지 함수는 인스턴스가 재사용되므로
 * 첫 요청만 초기화 비용을 낸다. 그 요청도 판코드가 불변이라 CDN이 한 번만 받는다.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';

let initialized: Promise<void> | undefined;

/**
 * wasm 모듈을 한 번만 초기화한다.
 *
 * @param wasm wasm 바이너리. Node에서는 파일을 읽어 넘기고, 엣지에서는
 *             번들러가 넣어준 모듈을 넘긴다. 런타임마다 조달 방법이 달라서
 *             여기서 결정하지 않고 호출자가 준다.
 */
export function initCardPng(wasm: ArrayBuffer | Uint8Array | Promise<unknown> | unknown): Promise<void> {
  initialized ??= initWasm(wasm as never).catch((e) => {
    // 실패를 캐시하면 이후 요청이 전부 "이미 초기화됨"으로 오해한다
    initialized = undefined;
    throw e;
  });
  return initialized;
}

export interface PngOptions {
  /** 출력 폭(px). SVG는 비율을 유지하며 이 폭에 맞춰진다. */
  width?: number;
}

export class PngNotInitialized extends Error {
  constructor() {
    super('initCardPng()를 먼저 호출해야 합니다. wasm 바이너리를 넘기세요.');
    this.name = 'PngNotInitialized';
  }
}

/** SVG 문자열을 PNG 바이트로. */
export function svgToPng(svg: string, options: PngOptions = {}): Uint8Array {
  if (!initialized) throw new PngNotInitialized();

  const resvg = new Resvg(svg, {
    // satori가 폰트를 이미 path로 바꿔놨으므로 resvg는 폰트를 볼 일이 없다.
    // 폰트 로딩을 끄면 wasm이 시스템 폰트를 찾느라 시간을 안 쓴다.
    font: { loadSystemFonts: false },
    ...(options.width ? { fitTo: { mode: 'width' as const, value: options.width } } : {}),
  });

  return resvg.render().asPng();
}
