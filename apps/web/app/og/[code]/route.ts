/**
 * OG 이미지. 카톡·트위터가 링크 미리보기로 가져가는 그림이다.
 * 이 라우트가 이 제품의 유통 경로 전체다 — 여기가 죽으면 공유가 파란 링크가 된다.
 *
 * 엣지가 아니라 Node 런타임이다. 판코드가 불변이라 CDN이 무한 캐시하므로
 * 콜드스타트는 사실상 첫 1회뿐이고, 엣지에서 wasm 조달은 번들러 종속적이라
 * 복잡도만 늘어난다.
 */

import { renderCard, svgToPng, UnsupportedGlyphs } from '@saju/card';
import { MalformedPanCode } from '@saju/manseryeok';

import { cardFont, pngReady } from '../../font.ts';

/** 판코드는 불변이다. 한 번 만든 이미지는 영원히 유효하다. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** 실패해도 미리보기가 비지 않도록 내보내는 최소 이미지. */
function fallbackSvg(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#16161a"/>
    <rect x="0" y="620" width="1200" height="10" fill="#8a8578"/>
  </svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml',
      // 폴백은 캐시하지 않는다. 원인이 고쳐지면 바로 진짜 카드가 나가야 한다.
      'cache-control': 'no-store',
    },
  });
}

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  try {
    await pngReady();
    const svg = await renderCard(code, { font: cardFont() });
    const png = svgToPng(svg, { width: 1200 });

    return new Response(png as unknown as BodyInit, {
      headers: { 'content-type': 'image/png', 'cache-control': IMMUTABLE },
    });
  } catch (error) {
    if (error instanceof MalformedPanCode) {
      // 추측한 URL이다. 캐시하지 않고 404로 끝낸다.
      return new Response('판코드가 올바르지 않습니다', { status: 404 });
    }
    // 폰트 결측·wasm 실패 등. 무증상으로 두면 안 되므로 로그를 남기고
    // 폴백 이미지를 낸다 — 미리보기가 깨진 이미지로 뜨는 것보다 낫다.
    console.error('[og] 카드 렌더 실패', {
      code,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      missingGlyphs: error instanceof UnsupportedGlyphs ? error.missing : undefined,
    });
    return fallbackSvg();
  }
}
