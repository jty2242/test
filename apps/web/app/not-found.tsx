import Link from 'next/link';

/**
 * 깨진 판코드로 들어온 사람이 보는 화면.
 * 빈 화면으로 두면 그 공유는 역효과가 된다 — 다시 뽑을 길을 준다.
 */
export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>링크가 잘못됐어요</h1>
      <p style={{ color: '#8a8578', fontSize: 14, marginTop: 12 }}>
        판코드를 읽을 수 없습니다. 직접 뽑아보시겠어요?
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '12px 24px',
          border: '1px solid #f4f2ed',
          borderRadius: 6,
          color: '#f4f2ed',
          textDecoration: 'none',
        }}
      >
        내 사주 뽑기
      </Link>
    </main>
  );
}
