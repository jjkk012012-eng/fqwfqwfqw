공장용 STEP 파트 견적 계산기 - leaf parser v2

핵심
- 외부 CDN 없이 STEP/STP 텍스트를 직접 분석합니다.
- PRODUCT / PRODUCT_DEFINITION / NEXT_ASSEMBLY_USAGE_OCCURRENCE 관계를 해석합니다.
- child가 있는 어셈블리/서브어셈블리는 제외하고 leaf part 후보만 표에 표시합니다.
- PRODUCT 이름이 design으로 뭉개지는 파일을 위해 PRODUCT_DEFINITION fallback, BREP/SOLID name fallback을 넣었습니다.
- 이 버전은 실제 3D 형상 뷰어가 아닙니다. 먼저 파트 리스트/수량/견적 입력 흐름을 안정화한 버전입니다.

설치
- index.html, styles.css, app.js, README.txt, data 폴더를 저장소 root에 넣으세요.
- GitHub Pages: main / root 설정이면 바로 동작합니다.

주의
- STEP 텍스트 파서는 CAD export 방식에 따라 파트명이 부족할 수 있습니다.
- 실제 형상 기반 절곡/R/두께/부피 계산은 OCCT 서버 또는 WASM 연동이 필요합니다.
