export const metadata = {
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
