공장용 STEP 견적 계산기 V10

수정 내용:
- 뷰어/업로드 유지
- 판금/절곡품의 홀/탭 후보 자동 초기값 추가
- STEP mesh만으로 나사산 확정은 불가하므로 기존 '탭' 컬럼을 '홀/탭'으로 표시
- 판금/절곡 공정에서는 홀/탭 후보를 타공비 기준으로 계산
- CNC/선반/프로파일에서는 탭 가공비 기준으로 계산
- HOOD_BODY/TOP_COVER 계열 판금은 기본 절곡 4회 후보로 보정
- WATER_BOTTLE SIDE/TOP 계열 판금은 기본 절곡 2회 후보로 보정
- 구매품은 홀/탭/절곡 자동값 0 유지

업로드 방법:
ZIP 내부의 index.html, styles.css, app.js, README.txt, data 폴더, vendor 폴더를 저장소 최상단(root)에 덮어쓰기 후 Commit/Push 하세요.
