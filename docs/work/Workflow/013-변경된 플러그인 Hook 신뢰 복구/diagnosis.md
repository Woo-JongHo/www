# 플러그인 Hook 신뢰 오류 진단

## 관찰

사용자가 `Hook failed`와 `plugin contents changed; hook approval required`를 보고했다. Codex CLI 0.169.0의 실제 hooks/list에서 BoxBox 세 개와 Vercel 다섯 개가 enabled=true, trustStatus=modified였다. 목록 파싱 오류·경고는 없었다.

## 입증된 경계

8개 모두 Hook 명령 정의의 currentHash 앞부분은 저장된 trusted_hash와 같고 플러그인 내용 지문 뒷부분은 trusted_content_hash와 달랐다. 정의 변경과 플러그인 내용 신뢰를 구분해야 한다. 이 메시지는 실행 전 신뢰 차단이며 이 관찰만으로 스크립트 내부 예외를 뜻하지 않는다.

Vercel 설치 캐시는 선언한 Git revision 882e66c2698689324c341b7bb8fd8beb92c27bf6과 같고 git status가 깨끗했다. BoxBox 캐시는 같은 0.2.8 설치 원본의 파일들과 바이트가 같았다. 현재 패키지의 무단 로컬 변경은 발견하지 못했다. 예전 승인 내용 지문을 만든 파일 집합이 보존돼 있지 않아 어느 파일이나 해시 계산 버전이 달라졌는지는 단정하지 않는다.

## 검토한 실행 범위

BoxBox는 고정 Node와 외부 설치 CLI를 호출하며 SessionStart·PostToolUse·Stop을 처리한다. 현재 프로젝트 off 모드는 disabled이며 자동 정렬 PASS가 아니다. Vercel은 세션 중복 상태·프로젝트 프로파일·컨텍스트 주입·설정에 따른 telemetry와 자기 세션의 임시 파일 정리를 처리한다. 설치 출처·현재 Hook 정의·직접 스크립트를 확인했다. 신뢰값 직접 편집이나 위험 우회 옵션은 사용하지 않는다.

## 복구와 검증

공식 CLI의 Hook 검토 경로에서 현재 내용을 승인하고 새 Native 목록의 8개 상태를 재조회한다. 실제 새 세션의 SessionStart·Stop을 관찰하고 모든 항목의 trust와 실제 발화를 같은 사실로 쓰지 않는다. 명령·스크립트 본문·전역 모델·프로젝트 설정을 바꿔 오류를 숨기지 않는다. 원본 목록·설치 무결성·정식 UI 기록·전후 설정 대조·실제 실행은 로컬 .www/hook-trust-20261115/에 보존한다.
