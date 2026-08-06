/**
 * KASI(한국천문연구원) 공공데이터 API 클라이언트 — 검증 전용.
 *
 * 런타임에는 안 쓴다. 엔진은 의존성 0을 유지한다. 이 파일은 절기 테이블을
 * 만들고 일주 앵커를 확정하는 오프라인 스크립트에서만 부른다.
 *
 * 인증키 주의: 포털이 인코딩/디코딩 두 형태를 준다. 인코딩된 키를 쿼리스트링에
 * 그대로 붙여야 한다. URLSearchParams에 넣으면 한 번 더 인코딩돼서 인증이 깨진다.
 */

const LRSR = 'http://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService';
const SPCDE = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

export class KasiError extends Error {
  // 생성자 파라미터 프로퍼티는 코드 생성이 필요해서 Node의 타입 스트리핑에서 못 쓴다.
  // 빌드 스텝을 안 두기로 했으므로 필드를 명시한다.
  resultCode: string;
  httpStatus: number;

  constructor(message: string, resultCode: string, httpStatus: number) {
    super(message);
    this.name = 'KasiError';
    this.resultCode = resultCode;
    this.httpStatus = httpStatus;
  }
}

function serviceKey(): string {
  const key = process.env.KASI_SERVICE_KEY;
  if (!key) {
    throw new Error(
      'KASI_SERVICE_KEY가 없습니다. .env.local에 넣고 `node --env-file=.env.local`로 실행하세요.',
    );
  }
  return key;
}

/** XML 한 겹만 벗긴다. 응답이 단순해서 파서를 끌어올 이유가 없다. */
function tag(xml: string, name: string): string | null {
  return xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;
}

function allBlocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);
}

async function call(url: string): Promise<string> {
  const res = await fetch(url);
  const body = await res.text();

  const code = tag(body, 'resultCode') ?? tag(body, 'returnReasonCode');
  const msg = tag(body, 'resultMsg') ?? tag(body, 'returnAuthMsg') ?? '';

  if (res.status !== 200 || (code && code !== '00')) {
    throw new KasiError(`KASI 요청 실패: ${msg || res.statusText}`, code ?? '?', res.status);
  }

  const total = Number(tag(body, 'totalCount') ?? '0');
  if (total === 0) {
    // 인증은 통과했는데 행이 0인 상태. 신청 직후 전파 지연이거나 범위 밖 날짜다.
    throw new KasiError(
      'KASI가 인증은 통과시켰지만 데이터를 0건 반환했습니다. ' +
        '해당 API 활용신청이 승인됐는지, 승인 후 충분히 지났는지 확인하세요.',
      '00-empty',
      res.status,
    );
  }

  return body;
}

export interface KasiDayInfo {
  solYear: number;
  solMonth: number;
  solDay: number;
  /** 간지 일진. 예: "신축" 또는 "신축(辛丑)" */
  iljin: string;
  /** 간지 세차(년) */
  secha: string | null;
  /** 간지 월건(월) */
  wolgeon: string | null;
  /** 율리우스적일 */
  julianDay: number | null;
}

/** 양력 날짜 하나의 음양력 정보. 일진이 여기 들어 있다. */
export async function fetchDayInfo(
  year: number,
  month: number,
  day: number,
): Promise<KasiDayInfo> {
  const url =
    `${LRSR}/getSolCalInfo?serviceKey=${serviceKey()}` +
    `&solYear=${year}&solMonth=${String(month).padStart(2, '0')}&solDay=${String(day).padStart(2, '0')}`;
  const xml = await call(url);
  const item = allBlocks(xml, 'item')[0] ?? xml;

  const iljin = tag(item, 'lunIljin');
  if (!iljin) throw new KasiError('응답에 lunIljin이 없습니다', '00', 200);

  return {
    solYear: Number(tag(item, 'solYear') ?? year),
    solMonth: Number(tag(item, 'solMonth') ?? month),
    solDay: Number(tag(item, 'solDay') ?? day),
    iljin,
    secha: tag(item, 'lunSecha'),
    wolgeon: tag(item, 'lunWolgeon'),
    julianDay: Number(tag(item, 'solJd')) || null,
  };
}

export interface KasiSolarTerm {
  /** 절기명. 예: "입춘" */
  name: string;
  year: number;
  month: number;
  day: number;
  /** "HHmm" 형식의 절입 시각 (KST) */
  time: string | null;
}

/** 한 달치 24절기. 절기 테이블은 이걸 1900~2100 전 구간 돌려서 만든다. */
export async function fetch24Divisions(year: number, month: number): Promise<KasiSolarTerm[]> {
  const url =
    `${SPCDE}/get24DivisionsInfo?serviceKey=${serviceKey()}` +
    `&solYear=${year}&solMonth=${String(month).padStart(2, '0')}&numOfRows=10`;
  const xml = await call(url);

  return allBlocks(xml, 'item').map((item) => ({
    name: tag(item, 'dateName') ?? '',
    year: Number(tag(item, 'locdate')?.slice(0, 4)),
    month: Number(tag(item, 'locdate')?.slice(4, 6)),
    day: Number(tag(item, 'locdate')?.slice(6, 8)),
    time: tag(item, 'kst'),
  }));
}
