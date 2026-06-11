STEP 견적 자동 산출 V38

- 뷰어 로직 재작성: OCCT root leaf node의 mesh index를 우선 사용합니다.
- 파트 클릭 시 해당 leaf part mesh만 중앙에 크게 표시합니다.
- 어셈블리 전체보기는 제거되어 있습니다.
- 구매품도 STEP 안에 mesh가 있으면 표시됩니다.
- OCCT leaf 파싱 실패 시에만 텍스트 파서 fallback을 사용합니다.
- GitHub Pages 업로드: ZIP 내용물을 저장소 root에 덮어쓰기 후 Commit/Push.

V39: selected part framing fix. Camera uses the mapped selected mesh only and ignores hidden original assembly meshes.
