/** @type {import('next').NextConfig} */
export default {
  // 워크스페이스 패키지를 .ts 소스 그대로 가져다 쓴다. 빌드 스텝을 안 두기로 한
  // 결정의 연장 — Next가 자기 컴파일러로 트랜스파일한다.
  transpilePackages: ['@saju/manseryeok', '@saju/card'],
  // wasm을 들고 있는 패키지는 번들에 넣지 않는다. webpack이 .wasm을 모듈로
  // 파싱하려다 실패한다. 외부로 두면 런타임에 node_modules에서 읽는다.
  serverExternalPackages: ['@resvg/resvg-wasm'],
  outputFileTracingIncludes: {
    // 폰트는 모듈로 인라인됐지만 wasm은 파일이다. require.resolve로 해석하므로
    // 대개 추적되지만, 놓치면 배포에서만 깨지므로 명시해둔다.
    '/og/[code]': ['../../node_modules/@resvg/resvg-wasm/*.wasm'],
  },
};
