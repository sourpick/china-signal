# 中 SIGNAL — 중국 마케팅 트렌드 월간 아카이브

중국 소비 트렌드와 한국 브랜드의 중국 마케팅 사례를 매달 기록하는 정적 사이트입니다.
외부 라이브러리 없이 Node.js만으로 빌드되며, GitHub Pages에 무료로 배포됩니다.

## 폴더 구조

```
china-signal/
├─ src/
│  ├─ site.json          사이트 이름, 내 이름·이메일·링크, 카테고리, 플랫폼 목록
│  ├─ about.md           About 페이지 본문
│  ├─ issues/2026-11.json 월호 설정: 홈 화면에 어떤 글을 어디에 놓을지, 이달의 숫자
│  ├─ posts/*.md         글 (마크다운). _template.md 를 복사해서 씁니다
│  ├─ images/            글에 쓸 사진 (선택)
│  └─ assets/            style.css(디자인), main.js(검색·필터·구독)
├─ build.js              src → dist 로 HTML을 만드는 스크립트
├─ serve.js              내 컴퓨터에서 미리보기
└─ .github/workflows/deploy.yml  GitHub Pages 자동 배포
```

## 처음 한 번: 내 정보 바꾸기

1. `src/site.json` 에서 `author`, `email`, `bio`, `links` 를 내 정보로 바꿉니다.
2. `src/about.md` 의 `[이름]`, `[경력]` 자리를 채웁니다.

## 내 컴퓨터에서 보기

[Node.js](https://nodejs.org) 18 이상을 설치한 뒤, 이 폴더에서:

```bash
npm start
```

브라우저에서 http://localhost:4000 을 엽니다. (설치할 패키지는 없습니다.)

## 매달 새 호 발행하기

1. **글 쓰기** — `src/posts/_template.md` 를 복사해 `2026-12-제목.md` 처럼 저장하고 내용을 씁니다.
   - `issue` 는 `2026-12` 처럼 월호, `type` 은 `report`(커버스토리) / `trend` / `case` 중 하나
   - `category` 는 `site.json` 의 카테고리 id (`trend`, `beauty`, `fashion`, `fnb`, `retail`, `platform`, `inbound`)
   - `slug` 는 주소가 될 영문 이름 (예: `my-post` → `posts/my-post.html`)
2. **월호 설정** — `src/issues/2026-11.json` 을 복사해 `2026-12.json` 으로 만들고,
   `vol`, `label`, `theme`, `ticker`, `cover`, `heroSide`, `trending`, `featureCase`, `cases`, `numbers` 를 새 글의 slug와 숫자로 바꿉니다.
   가장 최신 월호가 홈에 걸리고, 지난 호는 아카이브에 그대로 남습니다.
3. **확인** — `npm start` 로 미리 봅니다.
4. **발행** — GitHub에 올리면(push) 자동으로 사이트가 갱신됩니다.

### 글에서 쓸 수 있는 블록

| 쓰는 법 | 결과 |
| --- | --- |
| `## 01 소제목` | 번호가 빨간색인 소제목 |
| `> 문장` | 검은 박스 인용구 |
| `:::summary` … `:::` | 3줄 요약 박스 |
| `:::stats` … `:::` | 숫자 카드 (`값 \| 설명`, 마지막 줄 `source: 출처`) |
| `:::checklist` … `:::` | 마케터 체크리스트 |
| `:::note` … `:::` | 작은 회색 메모 (예: "필자의 해석입니다") |
| `:::refs` … `:::` | 참고 자료 목록 |

### 사진 넣기

지금은 사진 대신 한자를 크게 넣은 커버를 씁니다. 직접 만든 이미지를 쓰려면
`src/images/` 에 파일을 넣고 글 상단에 `image: 파일이름.jpg` 를 추가하세요.

## GitHub Pages로 배포하기 (처음 한 번)

1. GitHub에서 새 저장소를 만들고(예: `china-signal`) 이 폴더 전체를 올립니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
3. `main` 브랜치에 올릴 때마다 자동으로 빌드·배포됩니다.
   주소는 `https://<내아이디>.github.io/china-signal/` 입니다.

모든 링크가 상대 경로라서 하위 폴더 주소에서도 그대로 작동합니다. 개인 도메인을 쓰려면 Settings → Pages → Custom domain 에서 연결하세요.

## 뉴스레터 연결

스티비·메일침프 등에서 구독 페이지를 만든 뒤, `site.json` 의 `newsletterUrl` 에 그 주소를 넣으면
구독 버튼이 그 페이지로 연결됩니다. 비워두면 "준비 중" 안내가 뜹니다.

## 디자인 바꾸기

색과 글꼴은 `src/assets/style.css` 맨 위 변수에서 바꿉니다. 예: 포인트 컬러 `--accent: #C8102E;`
