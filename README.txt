STEP 견적 자동 산출 V27
- 뷰어는 V26 기준 유지: 선택한 말단 파트만 표시, 구매품도 mesh가 있으면 표시
- 추천 로직 개선: 구매품/판금/CNC/선반/사출/3D/압출 점수제 + 신뢰도 표시
- 어셈블리는 표시하지 않고 말단 파트만 표에 표시
- 단가표 저장/다운로드/불러오기/붙여넣기 지원
- 용접 카테고리 없음
GitHub Pages: ZIP 안의 내용물만 저장소 root에 덮어쓰기


V28: 추천 규칙 강화. 압축 해제 후 폴더 용량은 약 90MB이며, GitHub 단일 파일 100MB 제한 이하로 구성했습니다. 실제 앱은 data/process_rules_core.json을 로드하고, data/recommendation_reference_90mb.json은 향후 서버/DB 분리용 대용량 참고 라이브러리입니다.
