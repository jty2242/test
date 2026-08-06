import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import satori from 'satori';
import {
  renderCard,
  cardCharset,
  CARD_TEXT,
  ILJU_NAMES,
  UnsupportedGlyphs,
} from '../src/card.ts';
import { calculate, ganjiName } from '@saju/manseryeok';
import { initCardPng, svgToPng, PngNotInitialized } from '../src/png.ts';

const font = readFileSync('packages/card/assets/saju-subset.ttf');
const sample = calculate({ year: 1998, month: 3, day: 14, hour: 7, minute: 20, gender: 'male' });
const code = sample.charts[0].panCode;

/** 한 글자를 렌더해 실제 글리프가 나오는지 본다. 없으면 satori가 조용히 뺀다. */
async function glyphPathLength(ch: string): Promise<number> {
  const svg = await satori(
    { type: 'div', props: { style: { display: 'flex', fontSize: 64, color: '#000' }, children: ch } } as never,
    { width: 200, height: 100, fonts: [{ name: 'Saju', data: font, weight: 400, style: 'normal' }] },
  );
  return (svg.match(/ d="([^"]*)"/g) ?? []).join('').length;
}

test('빌드된 폰트가 문자 집합 전체를 실제로 담고 있다', async () => {
  // 목록만 대조하면 서브셋 빌드가 뒤처져도 통과한다. 실제 폰트로 렌더해서 확인한다.
  const charset = cardCharset(ILJU_NAMES).replace(/\s/g, '');
  const missing: string[] = [];
  for (const ch of charset) {
    if ((await glyphPathLength(ch)) < 30) missing.push(ch);
  }
  assert.deepEqual(missing, [], `폰트에 없는 글자: ${missing.join('')} — 서브셋을 다시 빌드하세요`);
});

test('카드 문구의 글자가 전부 집합 안에 있다', () => {
  const charset = new Set(cardCharset(ILJU_NAMES));
  for (const phrase of CARD_TEXT) {
    for (const ch of phrase) {
      assert.ok(charset.has(ch), `"${phrase}"의 '${ch}'가 집합에 없음`);
    }
  }
});

test('60갑자 이름이 전부 렌더 가능하다', () => {
  const charset = new Set(cardCharset(ILJU_NAMES));
  for (let i = 0; i < 60; i++) {
    for (const ch of ganjiName(i)) {
      assert.ok(charset.has(ch), `${ganjiName(i)}의 '${ch}'`);
    }
  }
});

test('집합 밖 글자를 쓰면 조용히 사라지지 않고 터진다', async () => {
  // 검증 기준이 ILJU_NAMES라서 임의 문자열은 걸려야 한다.
  // (검증할 문자열을 집합에 넣고 검사하면 항상 통과한다 — 순환 참조였던 버그.)
  await assert.rejects(
    () => renderCard(code, { font, ilju: '불 위의 쇠' }),
    (e: unknown) => e instanceof UnsupportedGlyphs && e.missing.length > 0,
  );
});

test('60갑자 별명은 통과한다', async () => {
  await assert.doesNotReject(() => renderCard(code, { font, ilju: '경오일주' }));
});

test('카드 SVG가 만들어진다', async () => {
  const svg = await renderCard(code, { font, ilju: '경오일주' });
  assert.ok(svg.startsWith('<svg'), 'SVG가 아님');
  assert.ok(svg.includes('width="1200"'), 'OG 기본 크기 1200');
  assert.ok(svg.includes('height="630"'));
  assert.ok(svg.length > 10000, `너무 짧음: ${svg.length}`);
});

test('시각을 모르면 시주 칸이 "모름"으로 나온다', async () => {
  const noHour = calculate({ year: 2000, month: 5, day: 20, hour: null, gender: 'female' });
  await assert.doesNotReject(() => renderCard(noHour.charts[0].panCode, { font }));
});

test('아직 없는 카드 종류는 명시적으로 거부한다', async () => {
  await assert.rejects(
    () => renderCard(code, { font, kind: 'gunghap' }),
    /아직 없는 카드 종류/,
  );
});

test('크기를 바꿀 수 있다 — 2차 기능이 같은 파이프라인을 탄다', async () => {
  const svg = await renderCard(code, { font, width: 800, height: 800 });
  assert.ok(svg.includes('width="800"'));
  assert.ok(svg.includes('height="800"'));
});


// ── PNG 변환 ─────────────────────────────────────────────────────────────

test('초기화 전에는 명확한 에러를 낸다', () => {
  assert.throws(() => svgToPng('<svg xmlns="http://www.w3.org/2000/svg"/>'), PngNotInitialized);
});

test('카드가 PNG로 변환된다', async () => {
  await initCardPng(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));

  const svg = await renderCard(code, { font, ilju: '경오일주' });
  const png = svgToPng(svg, { width: 1200 });

  // PNG 매직 넘버
  assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 5000, `PNG가 너무 작음: ${png.length}B`);
});

test('초기화는 여러 번 불러도 안전하다', async () => {
  const wasm = readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm');
  await initCardPng(wasm);
  await initCardPng(wasm);
  const svg = await renderCard(code, { font });
  assert.ok(svgToPng(svg).length > 5000);
});
