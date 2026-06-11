공장용 STEP 견적 계산기 Real Viewer V5

사용 방법
1. 이 폴더의 파일(index.html, styles.css, app.js, vendor, data)을 GitHub 저장소 root에 넣습니다.
2. GitHub Pages를 main / root로 배포합니다.
3. 페이지에서 STEP/STP 파일 선택 버튼을 눌러 업로드합니다.

중요
- 외부 CDN을 쓰지 않습니다. occt-import-js wasm과 Three.js를 vendor 폴더에 포함했습니다.
- 브라우저 보안상 로컬 더블클릭보다 GitHub Pages 또는 python -m http.server 실행을 권장합니다.
- OCCT mesh 파싱 성공 시 3D 뷰어에 실제 mesh를 표시합니다.
- STEP 텍스트 파서는 PRODUCT_DEFINITION_FORMATION -> PRODUCT 매핑을 사용해 "Next assembly relationship" 대신 실제 제품명을 표시합니다.
