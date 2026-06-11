공장용 STEP 견적 계산기 V8

수정 핵심
1) PRODUCT_DEFINITION leaf가 숫자/Next assembly relationship으로 뜨는 문제 보정
   - PRODUCT_DEFINITION -> PRODUCT_DEFINITION_FORMATION -> PRODUCT 이름 우선 사용
   - 그래도 안 잡히면 STEP 엔티티 번호상 바로 앞 PRODUCT 이름을 fallback 사용
   - 최종 표시명 기준으로 다시 그룹핑하여 같은 파트 중복 표시 감소

2) 절곡 자동 후보 개선
   - 단순 90도 모서리만 보고 절곡으로 잡지 않음
   - mesh에서 얇은 판재/쉘형 + 서로 다른 큰 판면 방향 2개 이상이면 절곡 1회 이상 후보
   - L브라켓/U브라켓/FLANGE/BEND/BENT/FOLD 이름 힌트는 보조 가산
   - 자동값은 후보이며 공장이 표에서 수정 가능

3) 공법 분류 개선
   - 구매품(볼트, 너트, 스크류, 리벳, 파이프, 니플 등) 우선
   - 프로파일/선반/판금 후보를 먼저 제외하고 남은 덩어리형을 CNC로 추천

업로드 방법
- 이 폴더 안의 index.html, styles.css, app.js, README.txt, data, vendor를 GitHub 저장소 root에 넣으세요.
- 폴더째 넣지 말고 내용물만 넣어야 GitHub Pages가 정상 작동합니다.


V8 수정: 절곡은 판면 방향 수가 아니라 기준판을 제외한 위치별 플랜지/귀 패치 수를 우선 카운트합니다. 얇은 판재에서 4개 플랜지가 있으면 절곡 4회로 잡습니다.
