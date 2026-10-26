# 작업조건 관리

사출 설비 작업조건을 제품별로 모아 보는 웹앱입니다. 거래처·제품을 고르면 최근 작업조건(이전 기록과 달라진 값 표시), 사진, 원료·특이사항 기록을 볼 수 있고, 휴대폰으로 사진·원료·특이사항을 추가할 수 있습니다.

- 화면: `index.html` (한 파일)
- 서버: `api/*.js` (Vercel 함수), 저장소: Vercel Blob (private)
- 환경변수: `APP_PIN`(공용 비밀번호), `BLOB_READ_WRITE_TOKEN`(Blob 연결 시 자동)
- 검색엔진 차단: `robots.txt`, `X-Robots-Tag`, `<meta name="robots">`
- 로컬 실행: `npm run dev` → http://localhost:3000 (`.localdata/` 폴더에 저장)
- 데이터는 저장소(GitHub)에 들어가지 않습니다.
