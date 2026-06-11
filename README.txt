공장용 STEP 견적 계산기 - Classifier V6

이번 버전 핵심:
1. 파일 선택 버튼/드래그 업로드 동작 유지
2. vendor 폴더에 OCCT/Three.js 포함, CDN 의존 없음
3. OCCT mesh가 잡히면 실제 3D 뷰어 표시
4. 말단 파트명은 STEP PRODUCT_DEFINITION -> PRODUCT 매핑 우선
5. 공법 자동분류를 이름만으로 하지 않고 mesh bbox/체적비/평면군/두께명/파트명을 점수화
6. 파이프/튜브/니플/피팅/볼트/너트/리벳/스크류/센서/모터/리드류는 구매품 우선
7. 프로파일은 2020/3030/4040/4080/PROFILE 계열만, PIPE/TUBE는 구매품 우선
8. 선반은 SHAFT/BUSH/ROLLER/COLLAR/ROD 또는 길쭉한 원통형 mesh 기준
9. 판금은 HOOD/COVER/PANEL/BODY/SIDE/TOP/WATER_BOTTLE 등 이름 + 얇은 판재/쉘형 mesh 기준
10. 절곡 자동값은 얇은 판재/쉘형 + normal cluster 또는 BEND/FLANGE/L/U BRACKET 힌트가 있을 때만 생성
11. CNC는 구매품/프로파일/선반/판금을 먼저 제외한 뒤, 덩어리형 체적비/두꺼운 T/BASE/BLOCK/JIG/PLATE류 기준으로 판단
12. 신뢰도 낮거나 점수차가 작으면 '분류 필요'로 두고 공장이 직접 선택

GitHub Pages 업로드:
- ZIP 안의 index.html, styles.css, app.js, README.txt, data 폴더, vendor 폴더를 저장소 root에 넣으세요.
- 폴더째 넣지 말고 내용물만 넣어야 합니다.
- Push 후 Pages에서 Ctrl+F5로 새로고침하세요.

주의:
- STEP에서 공차/재질/진짜 절곡 R/나사산이 항상 들어있지는 않습니다.
- 이 프로그램은 자동 추천을 먼저 채우고, 공장이 최종 수정하는 구조입니다.
