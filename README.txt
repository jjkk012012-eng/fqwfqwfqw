공장용 STEP 견적 계산기 V11

이번 버전 핵심
- OCCT 실제 mesh 뷰어 유지
- #82708 같은 숫자 leaf/가짜 PRODUCT_DEFINITION 행 제거
- 실제 mesh 이름과 PRODUCT 이름을 다시 매칭
- 판금 분석을 이름 고정값이 아니라 mesh 기반으로 보강
- 얇은 판재에서 기준판과 다른 방향의 연결 성분을 클러스터링해 절곡 후보 계산
- 작은 compact 성분을 홀/탭 후보로 분리
- HOOD_SKEL/HOOD_BODY처럼 판금류는 mesh 결과와 기본 규칙을 함께 적용
- 모든 값은 공장 수정용 초기값이며, 표에서 바로 수정 가능

GitHub Pages 업로드 방법
ZIP 안의 내용물(index.html, styles.css, app.js, README.txt, data, vendor)을 저장소 root에 넣고 Commit/Push 하세요.
압축 폴더째 넣으면 안 됩니다.
