공장용 STEP 견적 계산기 V14

핵심 변경
- 공장장용 간편 레이아웃 유지
- STEP/STP OCCT 3D 뷰어 유지
- 말단 파트만 견적 대상
- 구매품은 예상 단가를 자동 입력하고 표에서 바로 수정 가능
- 재료비는 kg/개 × 수량 × 재료 시세/kg × 할증%로 계산
- 공정비는 공정별 단가표 기준으로 계산
- 판금 절곡은 판면 방향이 아니라 기준판에서 접힌 플랜지/절곡선 후보를 계산
- 원형/타원형 feature loop는 홀/타공 후보로 계산
- 홀/절곡 값은 자동 초기값이며 공장이 숫자 칸에서 바로 수정 가능

GitHub Pages 업로드
1) ZIP 압축 해제
2) index.html, styles.css, app.js, README.txt, data 폴더, vendor 폴더를 저장소 root에 넣기
3) GitHub Desktop에서 Commit → Push
4) Pages 주소에서 Ctrl+F5

주의
- STEP mesh만으로 탭/나사산은 100% 확정하기 어렵기 때문에 홀/탭 후보로 표시합니다.
- 구매품 단가는 예상값입니다. 공장이 구매단가 칸에서 수정하면 바로 견적에 반영됩니다.
