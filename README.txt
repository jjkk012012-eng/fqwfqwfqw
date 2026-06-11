공장용 STEP 견적 계산기 - leaf parser fixed

핵심 수정:
- PRODUCT 이름만 집계하지 않음
- NEXT_ASSEMBLY_USAGE_OCCURRENCE의 parent/child PRODUCT_DEFINITION 관계를 읽음
- child가 있는 assembly/subassembly 컨테이너는 견적 제외
- 말단 leaf occurrence만 견적표에 표시
- occurrence name을 우선 파트명으로 사용
- 실패 시 PRODUCT_DEFINITION / BREP fallback 및 진단창 표시

주의:
- 이 버전은 외부 CDN 없이 STEP 텍스트 구조를 안정적으로 읽기 위한 버전입니다.
- 실제 3D 형상/절곡 R 판별은 CAD kernel 연동이 필요합니다.
