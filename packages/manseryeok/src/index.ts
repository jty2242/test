/**
 * @saju/manseryeok — 만세력 엔진. 의존성 0, 순수 함수, 부수효과 없음.
 * 사이트를 전혀 모른다. Next도 KV도 fetch도 여기 들어오지 않는다.
 *
 * 계산 규약 (바꾸면 결과가 바뀐다, README에도 적을 것):
 *   진태양시   동경 135° 표준시 → 한국 실제 경도 127.5° 보정 (약 -32분) + 균시차
 *   서머타임   1948~1961 시행 구간 보정
 *   연 경계    입춘 기준 (양력 1월 1일 아님)
 *   자시       야자시/조자시 둘 다 계산해서 반환. 어느 쪽인지는 Pan.jasi가 담는다
 *   일주 앵커  양력 1984-02-02 = 병인(丙寅). KASI 음양력 API 1차 자료로 확정.
 *              경과일수 경로와 JDN 경로가 독립 구현이고 381건에서 일치.
 *   절기 시각  UTC로 저장하고 표시할 때만 KST 변환 (KST 저장은 진태양시와 이중 보정 위험)
 *   지원 연도  1900~2100
 */

export type {
  Pan,
  GanjiIndex,
  Gender,
  JasiPolicy,
} from './types.ts';

export {
  STEMS,
  BRANCHES,
  stemOf,
  branchOf,
  ganjiName,
} from './types.ts';

export {
  encodePanCode,
  decodePanCode,
  MalformedPanCode,
  InvalidPan,
} from './pan-code.ts';

export { isDst, meridianFor, standardOffsetMinutes } from './timezone.ts';

export {
  toTrueSolarTime,
  equationOfTime,
  SEOUL_LONGITUDE,
} from './true-solar-time.ts';
export type { WallClock, TrueSolarResult, TrueSolarOptions } from './true-solar-time.ts';

export {
  DAY_ANCHOR,
  dayPillarFromDate,
  dayPillarFromJdn,
  julianDayNumber,
  dayAndHourPillars,
  hourBranchIndex,
  hourStemIndex,
  toGanji,
} from './day-hour-pillar.ts';
export type { DayHourPillars, TrueSolarMoment } from './day-hour-pillar.ts';

export {
  SOLAR_TERMS,
  MONTH_BOUNDARY_TERMS,
  TERM_ACCURACY_MINUTES,
  solarTermsInYear,
  solarTerm,
  termBoundaryProximity,
} from './solar-terms.ts';
export type { SolarTerm, SolarTermName, BoundaryProximity } from './solar-terms.ts';

export {
  apparentSolarLongitude,
  deltaT,
  julianDayUt,
  fromJulianDay,
} from './solar-position.ts';

/*
 * 아직 없는 것:
 *   년주 — 입춘 기준으로 해가 바뀐다 (절기는 준비됨)
 *   월주 — 12절(節)이 월의 경계다 (절기는 준비됨)
 *   대운 — 월주 + 성별 × 년간 음양으로 순행/역행
 */
