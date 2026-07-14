---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 개발 환경 셋업 (SETUP)

PawBloom 신규 개발자를 위한 로컬 개발 환경 구축 문서. 0002 MVP 로드맵에서
구현·환경 성격 자산만 추출했다. merge gate 규칙은 별도 문서와 중복되므로
[QUALITY.md](./QUALITY.md)로 링크하고, store 제출 전 계정 준비물은
[RELEASE.md](./RELEASE.md)로 넘긴다.

> 명령 예시는 Windows PowerShell 기준이다. macOS/Linux에서는 `npm.cmd`를
> `npm`으로 바꿔 실행한다.

## 아키텍처 환경 제약

셋업 단계에서 반드시 지켜야 하는 boundary 규칙:

- Mobile app은 Supabase service role key와 OpenAI API key를 **절대 포함하지
  않는다.** AI 호출은 Supabase Edge Function에서만 수행한다.
- Supabase generated DB type 원본은
  `apps/mobile/generated-supabase/database.types.ts`에 두고, shared-kernel의
  `database.types.ts`는 이 파일을 type-only로 다시 export한다.
- 사용자 문구는 `apps/mobile/src/i18n/translations.ts`에 둔다.
- 스타일은 `apps/mobile/src/design-system`의 token/icon/typography/spacing을
  기준으로 한다.

## 지금 필요한 다운로드·계정·설정

| 항목 | 목적 | 설정 | 확인 |
| --- | --- | --- | --- |
| Node.js 22.11+ / npm 10+ | Expo, TypeScript, script 실행 | Node 공식 installer 사용 | `node -v`, `npm -v` |
| Git | branch, worktree, PR workflow | Git 공식 installer 사용 | `git --version` |
| VS Code 또는 동급 editor | TypeScript 탐색과 터미널 작업 | TypeScript/ESLint extension 권장 | workspace 정상 열림 |
| Docker Desktop | Supabase local stack | Windows에서는 WSL2 backend 권장 | `docker --version` |
| Supabase CLI | local DB, migration, generated type | 전역 설치 또는 `npx supabase` 사용 | `npx supabase --version` |
| Supabase account/project | Auth, Postgres, Storage, Edge Functions | region은 `ap-southeast-2` Sydney | Dashboard project 생성 |
| Expo account | EAS Build/Submit | expo.dev 계정 생성 | `eas login` |
| EAS CLI | iOS/Android cloud build | `npm.cmd install --global eas-cli` | `eas --version` |
| Expo Go | 기본 모바일 개발 런타임 | iOS Simulator 또는 실제 기기에 설치 | Expo Go 홈 화면 표시 |
| Android 실제 기기 | Galaxy/Android QA | Developer Options, USB debugging 활성화 | APK 설치 가능 |
| iPhone 실제 기기 | iOS QA | TestFlight 또는 development build 확인 | 앱 설치 가능 |

Supabase region을 `ap-southeast-2` (Sydney)로 고정하는 이유: 한국 사용자
기준으로 실사용 가능한 지연이면서, 초기 대상 사용자/테스터의 지리적 분포에
맞춘 결정이다.

### 있으면 좋은 항목

- **Android Studio**: local Android SDK, device log, emulator
- **macOS + Xcode**: local iOS build/simulator
- **Deno CLI**: Edge Function local type check
- **GitHub CLI**: PR 생성과 review 자동화
- **Bruno 또는 Postman**: Edge Function/API 수동 테스트

### Store 제출 전 계정 준비물

Apple Developer Program, Google Play Console, Google service account key,
privacy policy URL, support email, store screenshot 등 store-facing 준비물은
[RELEASE.md](./RELEASE.md)에서 관리한다.

## 로컬 실행 명령

### 1. 초기 설치와 전체 검증

```powershell
node -v
npm -v
npm.cmd install --prefix apps/mobile
npm.cmd run verify
```

`npm.cmd run verify`가 P0 완료 기준이다. 통과 후 web preview 확인까지 되면
개발 환경 baseline이 선다.

### 2. Expo Go로 iOS 개발

일상적인 iOS 개발은 네이티브 PawBloom Debug 앱이 아니라 Expo Go를 기본
런타임으로 사용한다. 아래 명령은 Metro를 시작하고 iOS Simulator의 Expo Go에서
PawBloom 프로젝트를 연다. `apps/mobile/package.json`의 `ios` script는 `--go`를
명시하므로 설치된 development client를 자동 선택하지 않는다.

```powershell
npm.cmd run mobile:ios
```

Metro가 실행 중이지 않은 상태에서 이전에 Xcode로 설치한 `PawBloom` Debug 앱을
홈 화면에서 직접 열면 `No script URL provided`가 표시될 수 있다. 이는 앱 로직
오류가 아니라 JS bundle을 제공할 Metro URL이 없는 development build 실행
오류다. Expo Go 개발에는 해당 앱이 필요하지 않으므로 제거하고 위 명령으로
실행한다. Xcode/development build는 Expo Go에 없는 native module 또는
release-specific 동작을 확인할 때만 별도로 사용한다.

Expo Go는 `expo-notifications`의 모든 네이티브 기능과 동일한 실행 환경을
제공하지 않는다. 일반 화면·상태·데이터 흐름은 Expo Go에서 개발하되, 알림 권한,
예약 수신, 백그라운드 동작의 최종 검증은 development build 또는 TestFlight에서
수행한다.

### 3. Emulator 없이 web preview 확인

```powershell
npm.cmd run mobile:export-web
npm.cmd run mobile:preview-web
```

브라우저 주소:

```text
http://127.0.0.1:8082/
```

### 4. Supabase local setup

local stack을 띄우고, migration을 적용하고, generated DB type을 최신화한다.
`gen types` 출력 경로는 generated 원본이며 shared-kernel boundary가 이를
type-only로 다시 export한다.

```powershell
npx supabase --version
npx supabase login
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local --schema public > apps/mobile/generated-supabase/database.types.ts
npm.cmd run verify
```

- `supabase start`: Docker 기반 local Postgres/Auth/Storage/Edge 실행
- `supabase db reset`: `supabase/migrations/**`를 처음부터 재적용해 local DB
  baseline을 확정
- `gen types --local --schema public`: local public schema 기준 TypeScript type을
  generated 원본 경로에 덮어쓴다. schema 변경 시마다 재실행한다.

관련 config/파일: `supabase/config.toml`, `supabase/migrations/**`.

### 5. EAS setup

```powershell
npm.cmd install --global eas-cli
eas login
eas init
eas build:configure
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

- `eas init` / `eas build:configure`: 프로젝트 연결과 `eas.json` 초기화
- `preview` profile: simulator/APK preview build용 (profile 정의는
  [RELEASE.md](./RELEASE.md)의 EAS Profile 참고)

## Merge gate

merge gate 규칙은 [QUALITY.md](./QUALITY.md)와 중복되므로 그 문서를 단일
기준(source of truth)으로 삼는다. 핵심 요약:

- `npm.cmd run verify` 통과 (typecheck, architecture boundary, i18n parity,
  AI safety wording, Supabase RLS/GRANT, offline outbox contract 포함)
- Supabase schema 변경은 RLS, explicit GRANT, generated DB type, RLS matrix
  review를 포함한다.
- Edge Function 변경은 request/response contract와 AI safety wording check를
  포함한다.
- Mobile UI 변경은 사용자 문구를 `apps/mobile/src/i18n/translations.ts`에 둔다.
- Cross-context 동작은 application use case 또는 domain event로 연결한다.
- Product Architecture Lead는 auth, role, RLS, AI safety, privacy, release
  변경을 승인한다.

세부 항목과 리뷰 루프는 [QUALITY.md](./QUALITY.md)를 따른다.

## 참고 자료

- OpenAI Harness Engineering: <https://openai.com/ko-KR/index/harness-engineering/>
- Expo Go: <https://docs.expo.dev/get-started/start-developing/>
- Expo EAS app store submission: <https://docs.expo.dev/deploy/submit-to-app-stores/>
- Expo development builds: <https://docs.expo.dev/develop/development-builds/create-a-build/>
- React Native environment setup: <https://reactnative.dev/docs/set-up-your-environment>
- Supabase local development: <https://supabase.com/docs/guides/local-development>
- Supabase changelog: <https://supabase.com/changelog>
