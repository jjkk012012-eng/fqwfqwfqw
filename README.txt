공장용 STEP 견적 계산기 Real Viewer V4

1. GitHub Pages에 올릴 때
- index.html, styles.css, app.js, README.txt, data 폴더가 저장소 root에 바로 있어야 합니다.
- 폴더째 넣지 마세요.

2. 뷰어 동작 방식
- 온라인 환경에서는 jsdelivr CDN의 occt-import-js와 three.js를 사용해 STEP mesh를 읽습니다.
- OCCT 파싱이 성공하면 실제 mesh를 3D 뷰어에 표시하고, leaf mesh node 기준으로 파트표를 만듭니다.
- OCCT 파싱이 실패해도 STEP 텍스트 파서가 PRODUCT_DEFINITION/NAUO 구조를 읽어 말단 파트명과 수량을 표시합니다.

3. 견적 원칙
- 어셈블리/서브어셈블리는 제외합니다.
- leaf part/occurrence만 견적 대상으로 표시합니다.
- 파이프/튜브/각관/볼트/너트/스크류/리벳/베어링은 구매품 우선입니다.
- CNC는 구매품/프로파일/선반/판금 후보를 제외한 뒤 남은 절삭 가공품으로 봅니다.
- 절곡 자동값은 이름 힌트 또는 실제 mesh 특징이 불확실하면 0으로 두고 공장이 직접 수정합니다.
