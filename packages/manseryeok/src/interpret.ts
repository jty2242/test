/**
 * 사주판 풀이. 일간과 오행 균형에서 결정론적으로 나온다.
 *
 * LLM을 안 쓴다. 판코드만 있으면 나오고, 비용이 0이고, 오프라인에서 돌고,
 * 테스트가 가능하다. LLM 리포트는 이 위에 얹는 것이지 이걸 대체하는 게 아니다
 * — LLM이 죽어도 풀이는 남아야 한다(설계 문서의 "LLM 실패 시 카드만 표시"보다
 * 한 칸 나은 상태).
 *
 * 대운은 여기서 못 낸다. 대운수는 출생 시각에서 절(節)까지의 거리로 정해지는데
 * 판코드에는 8글자·성별·자시 정책만 들어 있고 생년월일시가 없다. 방향(순행/역행)만
 * 알 수 있으나 나이 없는 방향은 반쪽이라 뺐다.
 */

import type { Pan } from './types.ts';
import { stemOf } from './types.ts';
import { elementBalance, ELEMENTS, type Element } from './elements.ts';

/** 일간(日干) — 사주 해석의 기준점. "나"를 가리키는 글자다. */
const DAY_MASTER: Record<string, { image: string; text: string }> = {
  甲: { image: '큰 나무', text: '곧게 위로 자라려는 성질입니다. 방향을 정하면 굽히지 않지만, 굽혀야 할 때를 놓치기도 합니다.' },
  乙: { image: '풀과 덩굴', text: '유연하게 감아 오릅니다. 부러지지 않고 돌아가지만, 기댈 것이 없으면 힘을 못 씁니다.' },
  丙: { image: '태양', text: '숨기지 않고 드러내 비춥니다. 주변을 밝히지만 그늘도 같이 만듭니다.' },
  丁: { image: '촛불', text: '가까운 것을 밝힙니다. 넓게 퍼지진 않아도 오래 곁을 지킵니다.' },
  戊: { image: '산과 제방', text: '버티고 막습니다. 쉽게 흔들리지 않지만 한번 무너지면 크게 무너집니다.' },
  己: { image: '밭의 흙', text: '품어서 기릅니다. 자기를 드러내기보다 남을 자라게 합니다.' },
  庚: { image: '원석과 도끼', text: '자르고 결단합니다. 다듬기 전에는 거칠고, 다듬으면 날이 섭니다.' },
  辛: { image: '보석과 칼날', text: '정밀하고 예민합니다. 작은 흠을 알아보지만 자기 흠도 크게 느낍니다.' },
  壬: { image: '바다와 큰 강', text: '흐르고 담습니다. 폭이 넓지만 어디로 갈지는 지형이 정합니다.' },
  癸: { image: '이슬과 비', text: '스며들어 적십니다. 소리 없이 닿지만 존재가 흐려지기도 합니다.' },
};

/** 오행이 넘칠 때 */
const EXCESS: Record<Element, string> = {
  木: '뻗으려는 힘이 강합니다. 벌여놓는 건 많고 거두는 게 아쉽습니다.',
  火: '드러내는 힘이 강합니다. 빨리 타오르고 빨리 식습니다.',
  土: '버티는 힘이 강합니다. 안정적이지만 움직여야 할 때 더딥니다.',
  金: '끊는 힘이 강합니다. 결단이 빠른 대신 되돌리기 어렵습니다.',
  水: '흐르는 힘이 강합니다. 유연한 대신 방향이 흩어집니다.',
};

/** 오행이 아예 없을 때 */
const ABSENCE: Record<Element, string> = {
  木: '뻗어 나갈 계기를 스스로보다 바깥에서 찾게 됩니다.',
  火: '드러내기보다 안으로 쌓는 편입니다.',
  土: '중심을 잡아줄 무게가 적어 자리를 자주 옮깁니다.',
  金: '끊고 정리하는 힘이 약해 오래 끌고 갑니다.',
  水: '유연하게 흐르기보다 한자리에서 굳는 편입니다.',
};

export interface Interpretation {
  /** "庚 — 원석과 도끼" */
  dayMasterTitle: string;
  dayMasterText: string;
  /** 지배 오행 문장. 8글자 중 3개 이상일 때만 "과다"로 본다. */
  excessText: string | null;
  /** 없는 오행 문장들 */
  absenceTexts: string[];
}

/** 8글자 중 이 이상이면 한쪽으로 쏠린 것으로 본다. 3주(6글자)면 비례로 낮춘다. */
function excessThreshold(total: number): number {
  return total >= 8 ? 3 : 3;
}

export function interpret(pan: Pan): Interpretation {
  const stem = stemOf(pan.day);
  const master = DAY_MASTER[stem];
  const balance = elementBalance(pan);

  const dominantCount = balance.counts[balance.dominant];
  const excessText =
    dominantCount >= excessThreshold(balance.total) ? EXCESS[balance.dominant] : null;

  return {
    dayMasterTitle: `${stem} — ${master.image}`,
    dayMasterText: master.text,
    excessText,
    absenceTexts: ELEMENTS.filter((e) => balance.counts[e] === 0).map((e) => ABSENCE[e]),
  };
}
