/**
 * 사주판의 정체성. 판코드로 인코딩되는 값 전부가 여기 있고, 여기 없는 값은
 * 판코드에 들어가지 않는다. 이 파일이 캐시 키의 정의다.
 *
 *   생년월일시 + 성별 ──▶ [엔진] ──▶ Pan ──▶ 판코드(5자) ──▶ URL · 캐시 키 · OG 이미지
 *                                    │
 *                                    └── 이름은 여기 없음. 클라이언트 표시 전용.
 */

/** 천간 10개. 인덱스 0=甲 … 9=癸 */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 지지 12개. 인덱스 0=子 … 11=亥 */
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/**
 * 60갑자 인덱스. 0=甲子 … 59=癸亥.
 * 천간은 idx%10, 지지는 idx%12 — 60에서 한 바퀴 맞아떨어진다.
 */
export type GanjiIndex = number;

export type Gender = 'male' | 'female';

/**
 * 자시(23:00~01:00) 처리 유파. 23시대 출생자에게만 결과가 갈린다.
 *   yaja  야자시 — 23시 이후를 익일로 본다 (국내 상용 서비스 다수)
 *   joja  조자시 — 23시 이후도 그날로 둔다 (시주만 자시)
 * 둘 다 정통이라 23시대 출생자에게는 두 판을 병기한다. 판코드는 어느 판인지 담는다.
 */
export type JasiPolicy = 'yaja' | 'joja';

/** 사주판. 시주는 출생 시각을 모르면 없다(3주). */
export interface Pan {
  year: GanjiIndex;
  month: GanjiIndex;
  day: GanjiIndex;
  /** null = 출생 시각 모름 → 3주로 계산 */
  hour: GanjiIndex | null;
  gender: Gender;
  jasi: JasiPolicy;
}

export function stemOf(ganji: GanjiIndex): string {
  return STEMS[ganji % 10];
}

export function branchOf(ganji: GanjiIndex): string {
  return BRANCHES[ganji % 12];
}

/** "庚午" 같은 표기 */
export function ganjiName(ganji: GanjiIndex): string {
  return stemOf(ganji) + branchOf(ganji);
}
