# 2026-11-16 연구 출처와 내용 재대조

이 검토는 2026-11-15 연구의 출처와 서술을 현재 공개된 공식 문서에 대조한 것이다. 제품을 직접 조작하거나 사용자 시험을 한 것은 아니다. 원문의 작성일 또는 revision을 확인할 수 없는 페이지는 현재 제공본만 대조했으며 과거 내용의 불변을 증명하지 않는다. 각 응답 본문과 HTTP 상태·최종 주소·ETag·Last-Modified·SHA-256은 `.www/evidence/session-completion-20261116/home001-sources/manifest.json` 및 같은 폴더에 보존한다. 14건 모두 HTTP 200이었다.

| 출처 | 재대조한 관측 | 연구의 주장과 범위 |
|---|---|---|
| [Linear My issues](https://linear.app/docs/my-issues) | 개인에게 배정된 일은 긴급·차단 등 묶음과 우선순위로 정렬하고 표시 설정을 바꾼다. | 출처 사실과 WWW 홈의 적용 제안을 구분한다. |
| [Linear Favorites](https://linear.app/docs/favorites) | 이슈·프로젝트·뷰 등을 사이드바 개인 바로가기에 둔다. | 복사본이 아닌 참조를 택하는 것은 WWW 제안이다. |
| [Linear 사이드바 변경 기록](https://linear.app/changelog/2024-12-18-personalized-sidebar) | 2024-12-18 변경 기록은 순서·숨김·알림 수/점·More를 설명한다. | 날짜는 제품 변경 기록의 날짜다. |
| [Linear Custom Views](https://linear.app/docs/custom-views) | 저장된 뷰와 여러 이슈·프로젝트 화면에서 Space로 Peek를 사용할 수 있다. | Peek가 모든 화면에 있다는 뜻은 아니다. |
| [Linear Search](https://linear.app/docs/search) | 워크스페이스 검색, 현재 뷰 검색과 최근 이슈 접근을 구분한다. | WWW의 검색 범위 표시는 제안이다. |
| [Linear Inbox](https://linear.app/docs/inbox) | 읽음과 알림 삭제·미루기를 구분한다. | 읽음을 승인 해결로 간주하지 않는 것은 WWW 판단이다. |
| [VS Code 레이아웃](https://code.visualstudio.com/docs/configure/custom-layout) | 주/보조 사이드바, 배치와 표시, 레이아웃 기억과 초기화를 설명한다. | WWW의 독립 패널은 제안이다. |
| [VS Code 화면](https://code.visualstudio.com/docs/editing/getting-started/userinterface) | 탐색 선택은 미리보기 탭을 재사용하고 명시적 열기는 별도 탭으로 남길 수 있다. | 상세 확인과 대화 진입의 분리는 추론이다. |
| [VS Code 접근성](https://code.visualstudio.com/docs/configure/accessibility/accessibility) | F6/Shift+F6 영역 이동과 Tab 탐색을 안내한다. | WWW의 복합 위젯 키보드 설계는 별도 검증해야 한다. |
| [Figma 왼쪽 탐색](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) | 추가 라벨 기본 켜짐, UI 최소화 및 사이드바 너비 변경을 안내한다. | WWW가 동일한 방식으로 동작한다는 주장이 아니다. |
| [Figma 오른쪽 패널](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) | 아무 선택이 없을 때와 레이어 선택 시의 속성이 다르다. | 선택 대상 표시를 WWW에 적용하는 것은 제안이다. |
| [Figma 키보드](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard) | hover와 별도 단축키 패널을 통한 발견을 설명한다. | 한글 입력 충돌 방지는 WWW 시험 항목이다. |
| [W3C 모달 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 모달의 Tab 범위, Escape 및 닫은 뒤 초점 복귀를 다룬다. | 실제 접근성 적합성을 인증하지 않는다. |
| [W3C 표적 크기](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24×24 CSS px 최소 표적 및 예외를 설명한다. | 36px 시작값은 WWW의 가설이다. |

연구 본문은 대안별 이점·비용, 단일 탐색 권고와 열린 결정, 업무/대화 데이터 소유·실패 복원·너비·키보드·사용자 여정을 기술한다. 공식 출처의 제품 기능과 WWW 적용 판단을 나눈 점을 검토했다. 2026-11-15에 기록한 WWW view 종류와 초기 상태는 당시 코드 관찰로 읽어야 한다. 현재 코드는 대시보드·프로젝트 목록·모니터링 등이 추가됐으므로 그 문장을 현재 제품 상태의 진술로 전용하지 않는다. 실사용 비교, 사용자 시간 절약률, 운영체제 입력 및 실제 화면의 검증은 이 연구의 성과로 주장하지 않는다.
