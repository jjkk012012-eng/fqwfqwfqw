STEP 견적 자동 산출 V43

수정 내용
- 공법 추천 로직을 제조 우선순위로 재정리
- 구매품/프로파일/선반/판금 우선 제외 후, 기하학적 솔리드 형상은 사출 또는 CNC로 추천
- 수지/금형/사출 힌트가 있으면 사출, 그 외 기하학적 솔리드 형상은 CNC/MCT 우선
- 판금/절곡은 이름만으로 확정하지 않고, 얇고 넓은 동일 두께 판재형일 때 추천
- 디자인 글자 크기와 여백 축소
- 기존 뷰어/단가표/견적 계산 기능 유지

업로드 방법
ZIP 압축 해제 후 index.html, styles.css, app.js, README.txt, data, vendor를 GitHub 저장소 root에 덮어쓰기.
Commit → Push → Pages에서 Ctrl+F5.
