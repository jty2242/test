# 배포

## Vercel 설정

저장소를 [vercel.com/new](https://vercel.com/new)에서 임포트하고 아래만 맞추면 된다.

| 항목 | 값 |
|---|---|
| Framework Preset | Next.js |
| **Root Directory** | **`apps/web`** |
| Build Command | (기본값) |
| Install Command | (기본값) |

Root Directory를 `apps/web`으로 두면 Vercel이 npm 워크스페이스를 인식해서
설치는 저장소 루트에서, 빌드는 앱에서 돌린다. 직접 건드릴 필요 없다.

## 환경변수

| 이름 | 필요 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 선택 | OG 이미지 절대 URL의 기준. 없으면 Vercel이 넣어주는 `VERCEL_PROJECT_PRODUCTION_URL`을 쓴다. 커스텀 도메인을 붙였다면 그 주소로 지정할 것 |
| `KASI_SERVICE_KEY` | 아니오 | 검증 스크립트 전용. 런타임에는 안 쓴다. Vercel에 넣지 말 것 |

**`metadataBase`가 잘못되면 카톡이 OG 이미지를 못 가져온다.** 상대 경로로 나가기
때문이다. 배포 후 `/s/{판코드}` 소스에서 `og:image`가 절대 https URL인지 확인할 것.

## 배포 후 확인

1. `/` 에서 사주를 뽑는다
2. `/s/{판코드}` 소스의 `og:image`가 **절대 https URL**인지 본다
3. `/og/{판코드}` 가 `image/png`와 `cache-control: ...immutable`로 오는지 본다
4. **실기기 카톡에 링크를 붙여넣는다.** 이게 이 프로젝트의 성공 판정이다.
   카톡은 미리보기를 공격적으로 캐시하므로, 안 뜨면 판코드를 바꿔가며 테스트할 것

## 알려진 함정

- **`require.resolve`를 쓰지 말 것.** webpack이 그 호출을 자기 모듈 시스템으로
  바꿔서 경로 대신 숫자 모듈 ID를 돌려준다. dev에서는 멀쩡하고 프로덕션
  빌드에서만 깨진다. `apps/web/app/font.ts` 주석 참조
- **`next build`는 캐시를 재사용한다.** 빌드 관련 수정을 검증할 때는 `.next`를
  지우고 다시 빌드할 것. 안 그러면 옛 산출물을 테스트한다
- `pkill -f "next start"`가 Windows에서 안 먹는다. `netstat -ano`로 PID를 찾아
  `taskkill //F //PID`로 죽일 것. 안 죽이면 옛 서버를 테스트하게 된다
- **폰트 서브셋은 `packages/card/src/font-data.ts`에 base64로 박혀 있다.**
  카드 문구를 바꿨으면 `node --experimental-strip-types scripts/build-font-subset.ts`를
  다시 돌릴 것. satori는 없는 글리프를 조용히 빼므로 안 돌리면 글자가 사라진다
