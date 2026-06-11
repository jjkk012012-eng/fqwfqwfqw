STEP 견적 자동 산출 V42

변경점
- 구매품 우선 분류 유지
- 판금/절곡 추천 로직 재작성
  * 같은 두께의 얇은 판재형이면 평판/절곡 여부와 관계없이 판금/절곡 추천
  * 추정 두께 = 2 × 체적 / 표면적 기준 추가
  * bbox 대비 체적이 낮은 얇은 판재형 기준 추가
  * HOOD/COVER/PANEL/SKEL/SIDE/TOP/WATER_BOTTLE 등 판금 계열명 보강
- 예전 오분류 학습값과 충돌하지 않도록 추천 학습 키 v42로 변경
- 선택 파트 상세에 두께추정/판재판정 표시

업로드 방법
ZIP 안 내용물(index.html, styles.css, app.js, README.txt, data/, vendor/)만 GitHub 저장소 root에 덮어쓰기 후 Commit → Push → Ctrl+F5.
