/** @type {import('next').NextConfig} */
export default {
  // 워크스페이스 패키지를 .ts 소스 그대로 가져다 쓴다. 빌드 스텝을 안 두기로 한
  // 결정의 연장 — Next가 자기 컴파일러로 트랜스파일한다.
  transpilePackages: ['@saju/manseryeok', '@saju/card'],
  outputFileTracingIncludes: {
    // 폰트와 wasm은 코드에서 경로로 읽으므로 추적에 안 잡힌다. 명시한다.
    '/og/[code]': ['../../packages/card/assets/**', '../../node_modules/@resvg/resvg-wasm/*.wasm'],
  },
};
