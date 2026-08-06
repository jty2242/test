import type { Metadata } from 'next';

/**
 * metadataBase가 없으면 og:image가 상대 경로로 나가고, 카톡 크롤러는 그걸
 * 못 가져온다. 배포 URL은 Vercel이 넣어주는 환경변수에서 읽는다.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : new URL('http://localhost:3111');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: '사주 카드',
  description: '생년월일시로 사주판을 뽑고 카드로 공유합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: '#16161a',
          color: '#f4f2ed',
          fontFamily: 'system-ui, -apple-system, "Malgun Gothic", sans-serif',
          minHeight: '100dvh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
