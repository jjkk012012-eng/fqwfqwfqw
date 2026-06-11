STEP 견적 자동 산출 - 공장용 서비스형 V17

업로드 방법:
1. ZIP 압축 해제
2. index.html, styles.css, app.js, README.txt, data, vendor 폴더를 GitHub 저장소 root에 덮어쓰기
3. GitHub Desktop에서 Commit → Push
4. GitHub Pages에서 Ctrl+F5

구조:
- 어셈블리/서브어셈블리는 표에서 제외
- 실제 파트만 표에 표시
- 구매품: 수량 × 구매단가 × 마진
- 판금/절곡: kg/개 × 판재 kg단가 + 절곡수 × 절곡단가 + 홀수 × 홀단가 + 마진
- CNC/선반/사출/3D/용접: kg/개 × 재질 kg단가 + 시간/개 × 시간당 단가 + 홀/탭 + 마진
- 압출/프로파일: kg/개 × 압출 kg단가 + 절단수/탭수 단가 + 마진

자동 분류는 초깃값이며, 공장장이 표에서 바로 수정해 확정하는 방식입니다.
