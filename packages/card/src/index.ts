/**
 * @saju/card — 판코드를 카드 이미지로.
 *
 * 프레임워크를 모른다. Next도 Vercel도 여기 안 들어온다. satori로 SVG를,
 * resvg-wasm으로 PNG를 만드는 것까지가 이 패키지의 일이고, 어디서 어떻게
 * 서빙할지는 호출자가 정한다.
 */

export {
  renderCard,
  cardCharset,
  CARD_TEXT,
  ILJU_NAMES,
  UnsupportedGlyphs,
  ELEMENT_COLORS,
} from './card.ts';
export type { CardKind, CardOptions } from './card.ts';

export { initCardPng, svgToPng, PngNotInitialized } from './png.ts';
export type { PngOptions } from './png.ts';
