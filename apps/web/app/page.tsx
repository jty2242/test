/**
 * 입력 화면. 모바일 우선.
 *
 * 서버 액션으로 계산하고 결과 페이지로 보낸다. 생년월일시는 서버에서 판코드로
 * 바뀐 뒤 버려진다 — URL에도, 로그에도, 어디에도 안 남는다.
 */

import { redirect } from 'next/navigation';

import { calculate, InvalidBirthInput } from '@saju/manseryeok';

const field: React.CSSProperties = {
  width: '100%',
  padding: '14px 12px',
  fontSize: 16, // iOS가 16px 미만이면 포커스 시 확대한다
  background: 'transparent',
  border: '1px solid #8a8578',
  borderRadius: 6,
  color: '#f4f2ed',
  boxSizing: 'border-box',
};

async function submit(formData: FormData) {
  'use server';

  const birth = String(formData.get('birth') ?? '');
  const time = String(formData.get('time') ?? '');
  const unknownTime = formData.get('unknownTime') === 'on';
  const gender = String(formData.get('gender') ?? '');

  const [year, month, day] = birth.split('-').map(Number);
  const [hour, minute] = unknownTime || !time ? [null, 0] : time.split(':').map(Number);

  let code: string;
  try {
    const result = calculate({
      year,
      month,
      day,
      hour,
      minute: minute ?? 0,
      gender: gender as 'male' | 'female',
    });
    code = result.charts[0].panCode;
  } catch (e) {
    if (e instanceof InvalidBirthInput) redirect(`/?error=${encodeURIComponent(e.message)}`);
    throw e;
  }

  redirect(`/s/${code}`);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>내 사주 보기</h1>
      <p style={{ color: '#8a8578', fontSize: 14, marginTop: 8 }}>
        생년월일시만 있으면 됩니다. 가입 없음.
      </p>

      {error ? (
        <p
          role="alert"
          style={{
            background: 'rgba(181,71,63,0.15)',
            border: '1px solid #b5473f',
            borderRadius: 6,
            padding: 12,
            fontSize: 14,
            marginTop: 20,
          }}
        >
          {error}
        </p>
      ) : null}

      <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#8a8578' }}>생년월일 (양력)</span>
          <input type="date" name="birth" required min="1900-01-01" max="2100-12-31" style={field} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#8a8578' }}>태어난 시각</span>
          <input type="time" name="time" style={field} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="unknownTime" />
          태어난 시각을 모릅니다 (시주 없이 3주로 계산)
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, color: '#8a8578', padding: 0 }}>성별</legend>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
              <input type="radio" name="gender" value="male" required /> 남
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
              <input type="radio" name="gender" value="female" /> 여
            </label>
          </div>
          {/* 왜 묻는지 밝힌다 — 설명 없는 질문은 첫 화면의 마찰이 된다 */}
          <p style={{ fontSize: 12, color: '#8a8578', marginTop: 8 }}>
            대운의 순행·역행 계산에만 쓰입니다.
          </p>
        </fieldset>

        <button
          type="submit"
          style={{
            ...field,
            marginTop: 8,
            background: '#f4f2ed',
            color: '#16161a',
            fontWeight: 600,
            border: 0,
            cursor: 'pointer',
          }}
        >
          사주 뽑기
        </button>
      </form>

      <p style={{ fontSize: 12, color: '#8a8578', marginTop: 24, lineHeight: 1.6 }}>
        진태양시 자동 보정 · 입춘 기준 연 적용 · 1900~2100년 지원
      </p>
    </main>
  );
}
