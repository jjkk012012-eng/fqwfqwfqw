STEP 견적 자동 산출 V44 - 리브 사출 / 일반 기하 CNC 로직

업로드 방법
1. 이 ZIP을 압축 해제합니다.
2. 폴더 안의 index.html, app.js, styles.css, README.txt, data, vendor를 GitHub Pages 저장소 루트에 덮어씁니다.
3. Commit / Push 후 브라우저에서 Ctrl+F5로 새로고침합니다.

V44 핵심 로직
- 구매품/프로파일/선반을 먼저 제외합니다.
- 리브, 보스, 스냅, 클립, 훅 등 사출 피처가 있으면 사출로 추천합니다.
- 종이접기처럼 같은 두께의 접힌 판재는 판금/절곡으로 추천합니다.
- 리브 없는 일반 기하학적 솔리드 형상은 CNC/MCT로 추천합니다.
- 공장장이 수정한 공법은 브라우저에 학습되어 다음 업로드 때 반영됩니다.

주의
- data/recommendation_reference_90mb.json은 GitHub 용량 기준을 맞춘 참고 데이터이며 앱 실행에는 직접 로드되지 않습니다.
- 단일 파일은 GitHub 100MB 제한 이하입니다.
