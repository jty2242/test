/**
 * 결과 페이지. 공유되는 주소이자 OG 이미지의 근거다.
 *
 * 판코드만으로 전부 복원된다 — 생년월일시가 URL에 없으므로 링크가 유출돼도
 * 생일이 새지 않는다.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  decodePanCode,
  ganjiName,
  stemOf,
  elementBalance,
  interpret,
  MalformedPanCode,
  ELEMENTS,
  type Pan,
} from '@saju/manseryeok';

const ELEMENT_COLORS: Record<string, string> = {
  木: '#4a7c59',
  火: '#b5473f',
  土: '#a8813f',
  金: '#8b8d8f',
  水: '#3f5b78',
};

function parse(code: string): Pan | null {
  try {
    return decodePanCode(code);
  } catch (e) {
    if (e instanceof MalformedPanCode) return null;
    throw e;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> },
): Promise<Metadata> {
  const { code } = await params;
  const pan = parse(code);
  if (!pan) return { title: '사주 카드' };

  const title = `${ganjiName(pan.day)} 일주`;
  const balance = elementBalance(pan);
  const description =
    balance.missing.length > 0
      ? `${balance.dominant} 과다 · ${balance.missing.join('')} 없음`
      : `${balance.dominant} 과다`;

  // 카톡·트위터가 이 이미지를 가져간다. 절대 URL이 아니어도 Next가 채워준다.
  const image = { url: `/og/${code}`, width: 1200, height: 630 };

  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const pan = parse(code);
  if (!pan) notFound();

  const balance = elementBalance(pan);
  const reading = interpret(pan);
  const pillars: Array<[string, number | null]> = [
    ['시', pan.hour],
    ['일', pan.day],
    ['월', pan.month],
    ['년', pan.year],
  ];

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px 64px' }}>
      <h1 style={{ fontSize: 32, margin: 0 }}>{ganjiName(pan.day)} 일주</h1>
      <p style={{ color: '#8a8578', margin: '6px 0 28px', fontSize: 14 }}>
        일간 {stemOf(pan.day)} · {pan.jasi === 'yaja' ? '야자시' : '조자시'} ·{' '}
        {pan.gender === 'male' ? '남' : '여'}
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        {pillars.map(([label, ganji]) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#8a8578', fontSize: 12, marginBottom: 6 }}>{label}</div>
            <div
              style={{
                border: label === '일' ? '2px solid #f4f2ed' : '1px solid #8a8578',
                background: label === '일' ? 'rgba(244,242,237,0.08)' : 'transparent',
                borderRadius: 6,
                padding: '14px 0',
                fontSize: 28,
                lineHeight: 1.15,
              }}
            >
              {ganji === null ? (
                <span style={{ fontSize: 14, color: '#8a8578' }}>모름</span>
              ) : (
                <>
                  {stemOf(ganji)}
                  <br />
                  {ganjiName(ganji)[1]}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', marginTop: 28 }}>
        {ELEMENTS.map((el) => {
          const n = balance.counts[el];
          return (
            <div
              key={el}
              style={{
                flexGrow: n === 0 ? 0.5 : n,
                background: n === 0 ? 'rgba(244,242,237,0.06)' : ELEMENT_COLORS[el],
                color: n === 0 ? '#8a8578' : '#f4f2ed',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {n === 0 ? el : `${el} ${n}`}
            </div>
          );
        })}
      </div>
      <p style={{ color: '#8a8578', fontSize: 13, marginTop: 10 }}>
        {balance.dominant} 과다
        {balance.missing.length > 0 ? ` · ${balance.missing.join('')} 없음` : ''}
      </p>

      <section style={{ marginTop: 36, lineHeight: 1.7 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{reading.dayMasterTitle}</h2>
        <p style={{ margin: 0, fontSize: 15 }}>{reading.dayMasterText}</p>

        {reading.excessText ? (
          <p style={{ marginTop: 16, fontSize: 15 }}>
            <strong style={{ color: '#8a8578', fontWeight: 400 }}>{balance.dominant} 과다 · </strong>
            {reading.excessText}
          </p>
        ) : null}

        {reading.absenceTexts.map((text, i) => (
          <p key={balance.missing[i]} style={{ marginTop: 12, fontSize: 15 }}>
            <strong style={{ color: '#8a8578', fontWeight: 400 }}>{balance.missing[i]} 없음 · </strong>
            {text}
          </p>
        ))}
      </section>

      {/* 카드 이미지 자체를 보여준다. 길게 눌러 저장하는 게 모바일의 저장 동작이다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/og/${code}`}
        alt={`${ganjiName(pan.day)} 일주 사주 카드`}
        width={1200}
        height={630}
        style={{ width: '100%', height: 'auto', marginTop: 32, borderRadius: 8 }}
      />

      <p style={{ color: '#8a8578', fontSize: 12, marginTop: 32, lineHeight: 1.6 }}>
        본 서비스는 오락 목적입니다. 의료·법률·재무 조언이 아닙니다.
      </p>
    </main>
  );
}
