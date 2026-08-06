/**
 * 판코드 → 카드 이미지. satori로 SVG를 만든다.
 *
 * 결과 화면 전용이 아니라 **판코드를 받아 이미지를 돌려주는 범용 함수**로
 * 짠다(E3). 2차의 궁합·오늘의 운세·도감이 같은 파이프라인을 타야 하므로
 * 카드 종류를 판별자로 분기하고 폰트·색 토큰·여백은 한 곳에서만 관리한다.
 *
 *   판코드 ──decode──▶ Pan ──▶ 레이아웃 ──satori──▶ SVG ──(resvg)──▶ PNG
 *
 * 레이아웃 의도 (와이어프레임 기준):
 *   1. 일간만 강조한다. 8글자를 평등하게 늘어놓으면 한자 표가 된다.
 *      하나를 앵커로 잡아야 "나는 경오일주"라는 정체성이 생기고 그게 공유 문구가 된다.
 *   2. 오행은 막대그래프가 아니라 비율 띠다. 없는 오행이 빈칸으로 보여야
 *      이야깃거리가 된다.
 *   3. 색은 지배 오행에서 뽑는다. 카드마다 인상이 달라진다.
 */

import satori from 'satori';
import {
  decodePanCode,
  ganjiName,
  stemOf,
  branchOf,
  elementBalance,
  ELEMENTS,
  STEMS,
  BRANCHES,
  type Element,
  type Pan,
} from '@saju/manseryeok';

/** 카드 종류. 2차 기능이 여기 붙는다. */
export type CardKind = 'saju' | 'gunghap' | 'daily';

export interface CardOptions {
  kind?: CardKind;
  /** OG 이미지 기본값 1200×630. 링크 미리보기 표준 비율. */
  width?: number;
  height?: number;
  /** 서브셋 폰트 (scripts/build-font-subset.ts 산출물) */
  font: ArrayBuffer | Buffer;
  /** 일주 별명. 없으면 간지 이름만 쓴다. 60갑자 카피는 T6에서 채운다. */
  ilju?: string;
}

/**
 * 오행 색. 전통 오방색(청적황백흑)을 화면용으로 재해석했다.
 * ⚠️ 설계 문서 Open Question 4 — 전통 오방색 그대로 갈지 아직 미결이다.
 *    카드의 인상을 결정하는 단일 선택이라 디자인 리뷰에서 확정할 것.
 */
const ELEMENT_COLORS: Record<Element, string> = {
  木: '#4a7c59',
  火: '#b5473f',
  土: '#a8813f',
  金: '#8b8d8f',
  水: '#3f5b78',
};

const INK = '#16161a';
const PAPER = '#f4f2ed';
const MUTED = '#8a8578';

/**
 * 카드가 쓰는 고정 문구 전체. 폰트 서브셋의 근거이자 유일한 출처다.
 *
 * satori는 폰트에 없는 글리프를 두부(□)로 그리지 않고 **조용히 빼버린다**.
 * "일간 庚"이 "일 庚"으로 렌더돼도 아무 에러가 안 난다. 그래서 문구를 코드에
 * 흩뿌리지 않고 여기 모아두고, 서브셋 빌드와 테스트가 같은 목록을 본다.
 */
export const CARD_TEXT = [
  '시', '일', '월', '년', '모름',
  '일간', '야자시', '조자시',
  '과다', '없음', '일주',
  ' · ',
] as const;

const HANGUL_STEMS = '갑을병정무기경신임계';
const HANGUL_BRANCHES = '자축인묘진사오미신유술해';

/**
 * 일주 별명(T6). 60갑자 카피가 생기면 여기 채운다.
 *
 * 폰트 서브셋과 런타임 가드가 **같은 목록**을 봐야 한다. 검증할 문자열을
 * 문자 집합에 넣고 그 집합으로 검사하면 항상 통과한다 — 순환 참조다.
 */
export const ILJU_NAMES: readonly string[] = [];

/**
 * 카드에 나올 수 있는 모든 글자.
 *
 * 이름은 서버로 오지 않으므로(이슈 3A) 집합이 닫혀 있다. 단 일주 별명(T6)은
 * 우리가 쓰는 문구라 빌드 시점에 알 수 있으므로 인자로 받아 합친다.
 */
export function cardCharset(iljuNames: readonly string[] = []): string {
  const ganjiKorean = Array.from(
    { length: 60 },
    (_, i) => HANGUL_STEMS[i % 10] + HANGUL_BRANCHES[i % 12],
  );
  return [
    ...new Set([
      ...STEMS,
      ...BRANCHES,
      ...ELEMENTS,
      ...ganjiKorean.join(''),
      ...CARD_TEXT.join(''),
      ...iljuNames.join(''),
      ...'0123456789',
    ]),
  ]
    .sort()
    .join('');
}

/**
 * 문자열이 서브셋 안에 있는지 확인한다. 없으면 조용히 사라지므로 터뜨린다.
 * 무증상 실패를 만들지 않는다는 원칙(에러 경로 설계)의 렌더러 판본이다.
 */
export class UnsupportedGlyphs extends Error {
  missing: string[];

  constructor(text: string, missing: string[]) {
    super(
      `폰트 서브셋에 없는 글자가 있습니다: ${missing.join('')} (문구: "${text}"). ` +
        'scripts/build-font-subset.ts의 문자 집합에 추가하고 다시 빌드하세요.',
    );
    this.name = 'UnsupportedGlyphs';
    this.missing = missing;
  }
}

function assertRenderable(text: string, charset: Set<string>): void {
  const missing = [...new Set(text)].filter((c) => !charset.has(c));
  if (missing.length > 0) throw new UnsupportedGlyphs(text, missing);
}

type Node = { type: string; props: Record<string, unknown> };

const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

/** 세로쓰기 간지 한 칸. 일간이면 테두리로 강조한다. */
function pillarCell(label: string, ganji: number | null, isAnchor: boolean): Node {
  return h(
    'div',
    { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 132 },
    h('div', { display: 'flex', fontSize: 20, color: MUTED, marginBottom: 10 }, label),
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 116,
        height: 168,
        borderRadius: 6,
        border: isAnchor ? `3px solid ${PAPER}` : `1px solid ${MUTED}`,
        background: isAnchor ? 'rgba(244,242,237,0.08)' : 'transparent',
      },
      ganji === null
        ? h('div', { display: 'flex', fontSize: 28, color: MUTED }, '모름')
        : h(
            'div',
            { display: 'flex', flexDirection: 'column', alignItems: 'center' },
            h('div', { display: 'flex', fontSize: 60, color: PAPER, lineHeight: 1.1 }, stemOf(ganji)),
            h('div', { display: 'flex', fontSize: 60, color: PAPER, lineHeight: 1.1 }, branchOf(ganji)),
          ),
    ),
  );
}

/** 오행 비율 띠. 0인 오행은 빗금 없이 빈칸으로 남긴다. */
function elementStrip(pan: Pan): Node {
  const balance = elementBalance(pan);
  return h(
    'div',
    { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 34 },
    h(
      'div',
      { display: 'flex', width: '100%', height: 34, borderRadius: 4, overflow: 'hidden' },
      ...ELEMENTS.map((el) => {
        const n = balance.counts[el];
        return h(
          'div',
          {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // 0인 오행도 자리를 남겨야 "없다"가 보인다
            flexGrow: n === 0 ? 0.5 : n,
            background: n === 0 ? 'rgba(244,242,237,0.06)' : ELEMENT_COLORS[el],
            color: n === 0 ? MUTED : PAPER,
            fontSize: 17,
          },
          n === 0 ? el : `${el} ${n}`,
        );
      }),
    ),
    h(
      'div',
      { display: 'flex', fontSize: 18, color: MUTED, marginTop: 12 },
      balance.missing.length > 0
        ? `${balance.dominant} 과다 · ${balance.missing.join('')} 없음`
        : `${balance.dominant} 과다`,
    ),
  );
}

function sajuLayout(pan: Pan, ilju: string | undefined): Node {
  const dominant = elementBalance(pan).dominant;

  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: INK,
      // 지배 오행이 카드 인상을 정한다
      borderBottom: `10px solid ${ELEMENT_COLORS[dominant]}`,
      padding: '48px 56px',
      justifyContent: 'space-between',
    },
    h(
      'div',
      { display: 'flex', flexDirection: 'column' },
      h('div', { display: 'flex', fontSize: 44, color: PAPER }, ilju ?? `${ganjiName(pan.day)} 일주`),
      h(
        'div',
        { display: 'flex', fontSize: 20, color: MUTED, marginTop: 8 },
        `일간 ${stemOf(pan.day)} · ${pan.jasi === 'yaja' ? '야자시' : '조자시'}`,
      ),
    ),
    h(
      'div',
      { display: 'flex', justifyContent: 'space-between', width: '100%' },
      pillarCell('시', pan.hour, false),
      pillarCell('일', pan.day, true),
      pillarCell('월', pan.month, false),
      pillarCell('년', pan.year, false),
    ),
    elementStrip(pan),
  );
}

/** 판코드 하나로 카드 SVG를 만든다. */
export async function renderCard(panCode: string, options: CardOptions): Promise<string> {
  const { kind = 'saju', width = 1200, height = 630, font, ilju } = options;

  const pan = decodePanCode(panCode);

  // 렌더 전에 글자 커버리지를 확인한다. satori는 없는 글리프를 말없이 빼므로
  // 여기서 안 막으면 "일간 庚"이 "일 庚"으로 나가도 아무도 모른다.
  // 기준은 폰트가 실제로 빌드된 집합이다 — ilju를 집합에 넣고 검사하면 안 된다.
  if (ilju) assertRenderable(ilju, new Set(cardCharset(ILJU_NAMES)));

  const layout =
    kind === 'saju'
      ? sajuLayout(pan, ilju)
      : (() => {
          throw new Error(`아직 없는 카드 종류입니다: ${kind}`);
        })();

  return satori(layout as never, {
    width,
    height,
    fonts: [{ name: 'Saju', data: font as Buffer, weight: 400, style: 'normal' }],
  });
}

export { ELEMENT_COLORS };
