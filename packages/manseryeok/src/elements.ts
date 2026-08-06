/**
 * 오행(五行) 집계. 카드의 주 시각 요소다.
 *
 * 사주판 8글자(천간 4 + 지지 4)를 목화토금수로 환산해 센다. 없는 오행이
 * 빈칸으로 보이는 게 카드의 이야깃거리가 되므로, 0도 결과에 남긴다.
 *
 *   천간  甲乙木  丙丁火  戊己土  庚辛金  壬癸水
 *   지지  寅卯木  巳午火  申酉金  亥子水  辰戌丑未土
 *
 * 지지의 토(辰戌丑未)가 네 개라 지지 12개가 오행에 고르게 안 나뉜다.
 * 목·화·금·수는 각 2개, 토는 4개다.
 */

import type { GanjiIndex, Pan } from './types.ts';

export const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
export type Element = (typeof ELEMENTS)[number];

/** 천간 인덱스 → 오행. 두 개씩 짝지어 순서대로 간다. */
const STEM_ELEMENTS: readonly Element[] = [
  '木', '木', '火', '火', '土', '土', '金', '金', '水', '水',
];

/** 지지 인덱스 → 오행. 子(0)부터 亥(11)까지. */
const BRANCH_ELEMENTS: readonly Element[] = [
  '水', // 子
  '土', // 丑
  '木', // 寅
  '木', // 卯
  '土', // 辰
  '火', // 巳
  '火', // 午
  '土', // 未
  '金', // 申
  '金', // 酉
  '土', // 戌
  '水', // 亥
];

export function elementOfStem(ganji: GanjiIndex): Element {
  return STEM_ELEMENTS[ganji % 10];
}

export function elementOfBranch(ganji: GanjiIndex): Element {
  return BRANCH_ELEMENTS[ganji % 12];
}

export type ElementCount = Record<Element, number>;

export interface ElementBalance {
  counts: ElementCount;
  /** 전체 글자 수. 시주가 없으면 6, 있으면 8. */
  total: number;
  /** 가장 많은 오행. 동수면 木火土金水 순서로 앞선 것. */
  dominant: Element;
  /** 하나도 없는 오행. 카드에서 빈칸으로 보여줄 것들. */
  missing: Element[];
}

/**
 * 사주판의 오행 균형.
 * 시주가 없으면(시각 모름) 6글자만 센다 — 없는 걸 0으로 채우지 않는다.
 */
export function elementBalance(pan: Pan): ElementBalance {
  const counts: ElementCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  const pillars: Array<GanjiIndex | null> = [pan.year, pan.month, pan.day, pan.hour];
  let total = 0;
  for (const g of pillars) {
    if (g === null) continue;
    counts[elementOfStem(g)]++;
    counts[elementOfBranch(g)]++;
    total += 2;
  }

  let dominant: Element = ELEMENTS[0];
  for (const e of ELEMENTS) if (counts[e] > counts[dominant]) dominant = e;

  return {
    counts,
    total,
    dominant,
    missing: ELEMENTS.filter((e) => counts[e] === 0),
  };
}
