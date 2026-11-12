export type EcosystemGroup = "app" | "development" | "records" | "future";

export interface EcosystemNode {
  id          : string         ;
  title       : string         ;
  subtitle    : string         ;
  group       : EcosystemGroup ;
  description : string         ;
  sources     : string[]       ;
  x           : number         ;
  y           : number         ;
}

export interface EcosystemEdge {
  from     : string  ;
  to       : string  ;
  label    : string  ;
  planned? : boolean ;
}

export const ecosystemGroups: { id: EcosystemGroup; title: string; description: string; y: number }[] = [
  { id : "app"         , title : "앱 실행"     , description : "요청이 실행되고 화면에 돌아오는 길" , y : 32  },
  { id : "development" , title : "개발 절차"   , description : "WWW 자체를 만드는 역할과 도구"      , y : 350 },
  { id : "records"     , title : "기록과 검토" , description : "무엇을 만들고 무엇을 확인했는가"    , y : 550 },
  { id : "future"      , title : "후속 방향"   , description : "아직 연결하지 않은 공유 생태계"     , y : 750 },
];

export const ecosystemNodes: EcosystemNode[] = [
  {
    id: "chat", title: "WWW 앱", subtitle: "대화 · 실행 · 승인", group: "app", x: 40, y: 100,
    description: "사용자가 요청을 보내고 공개 설명, 명령, 파일 변경을 읽는 화면입니다. 입력 초안과 읽기 위치는 React 화면이 소유합니다. 이 생태계 지도도 같은 앱 안에서 열립니다.",
    sources: ["src/renderer.tsx", "docs/PRODUCT.md", "docs/specs/chat.md"],
  },
  {
    id: "bridge", title: "제한된 브리지", subtitle: "preload · 허용된 IPC", group: "app", x: 330, y: 100,
    description: "화면이 권한 있는 main 프로세스에 요청하는 통로입니다. renderer는 Node 기능을 직접 쓰지 않고 공유 계약에 정의한 기능만 호출합니다.",
    sources: ["src/preload.ts", "src/shared.ts"],
  },
  {
    id: "main", title: "Electron main", subtitle: "작업 폴더 · 프로세스 · 요청", group: "app", x: 620, y: 100,
    description: "앱과 Native 프로세스의 생명주기, 작업 폴더, 사건 순번과 승인 응답을 관리합니다. rpc 모듈을 통해 JSONL / JSON-RPC로 로컬 Native와 통신합니다.",
    sources: ["src/main.ts", "src/rpc.ts", "src/native-command.ts"],
  },
  {
    id: "native", title: "Codex Native", subtitle: "로컬 codex app-server", group: "app", x: 910, y: 100,
    description: "선택한 작업 폴더에서 AI 턴을 실행하는 로컬 엔진입니다. 응답·명령·파일 변경·승인 요청을 사건으로 전달합니다. 개발 역할인 www-dev와는 별개입니다.",
    sources: ["src/main.ts", "docs/ARCHITECTURE.md", "docs/specs/chat.md"],
  },
  {
    id: "projection", title: "사건 투영", subtitle: "관찰 사건 → 읽을 수 있는 블록", group: "app", x: 620, y: 230,
    description: "thread / turn / item / request 사건을 대화·명령·파일·승인 블록과 실행 상태로 바꾸는 순수 함수입니다. 사건은 최근 2,000개를 보관하며 실행 종료와 업무 완료를 구분합니다.",
    sources: ["src/projection.ts", "test/projection.test.ts"],
  },
  {
    id: "role", title: "WWW 개발 역할", subtitle: "www-dev · 요청과 권한 판단", group: "development", x: 40, y: 420,
    description: "WWW를 개발하는 Codex 역할입니다. AGENTS.md에서 진입해 기존 작업을 찾거나 등록하고 필요한 단계를 선택합니다. 역할 파일의 존재가 독립 프로세스나 자동 훅 등록을 뜻하지는 않습니다.",
    sources: ["AGENTS.md", "agents/www/AGENT.md"],
  },
  {
    id: "skills", title: "WWW Skills", subtitle: "명세 → 설계 → 구현 → 검증", group: "development", x: 330, y: 420,
    description: "www-spec, www-design, www-build, www-diagnose, www-verify, www-commit이 각 단계의 절차를 맡습니다. 필요한 단계만 선택하며 스킬 선택 자체가 커밋·게시 권한을 만들지 않습니다.",
    sources: ["skills/www", "docs/skills/CATALOG.md", "docs/skills/WORKFLOW.md"],
  },
  {
    id: "host", title: "개발 호스트", subtitle: "Codex · 기존 GJC opt-in", group: "development", x: 620, y: 420,
    description: "역할이 선택한 단계와 허용 범위를 실제 개발 세션에 전달합니다. Codex 어댑터와 기존 GJC 경로가 있으며 실제 호스트 수용과 합성 fixture 성공은 별도로 검증합니다.",
    sources: ["scripts/workflow/run.ts", "scripts/workflow/adapters", "docs/DEVELOPMENT.md"],
  },
  {
    id: "core", title: "공유 작업 core", subtitle: "접수 · 재개 · 완료 판정", group: "development", x: 910, y: 420,
    description: "작업 UUID, 허용 경로, 실행 전 조건, 증거 적용성과 필수 검토를 연결합니다. 앱과 CLI가 같은 core와 검토 정책을 사용하며 프로세스 종료만으로 작업을 완료하지 않습니다.",
    sources: ["scripts/workflow/work.ts", "scripts/workflow/route.ts", "scripts/workflow/preflight.ts", "src/development.ts"],
  },
  {
    id: "work", title: "작업 기록", subtitle: "work.json · spec · design", group: "records", x: 40, y: 620,
    description: "docs/work의 작업별 기록이 목표와 수용 기준, 권한, 현재 상태를 소유합니다. UUID가 기계 식별자이며 사람이 보는 번호와 목차는 탐색용입니다.",
    sources: ["docs/work/INDEX.md", "docs/skills/WORKFLOW.md", "scripts/workflow/schema.ts"],
  },
  {
    id: "evidence", title: "검증 증거", subtitle: "소스 · 기준 · 실제 검사", group: "records", x: 330, y: 620,
    description: "검사 시점의 파일 내용과 기준을 실제 실행 결과에 연결합니다. 소스가 바뀌면 과거 성공을 현재 성공으로 옮겨 쓰지 않습니다. 큰 원본은 .www/evidence, 정제한 관찰은 verification.md에 보관합니다.",
    sources: ["scripts/workflow/evidence.ts", "scripts/workflow/consistency.ts", "docs/skills/WORKFLOW.md"],
  },
  {
    id: "documents", title: "현행 정본 문서", subtitle: "제품 · 구조 · 기능 · 개발", group: "records", x: 620, y: 620,
    description: "PRODUCT, ARCHITECTURE, 기능 명세와 DEVELOPMENT가 현재 의도된 동작과 책임을 설명합니다. 완료 전 문서 영향 검토를 소스·기준·문서 지문에 연결합니다. 이 지도는 그 구조를 요약한 안내입니다.",
    sources: ["docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "scripts/workflow/documentation.ts"],
  },
  {
    id: "review", title: "독립 검토", subtitle: "읽기 전용 Opus · 정책 적용", group: "records", x: 910, y: 620,
    description: "저작과 별도 패스로 실행한 검토를 완료 판정에 연결합니다. 기본 검토자는 Opus이며 사용량 소진이 입증된 경우에만 정책의 Terra 대체가 허용됩니다. 실행하지 않은 검토는 통과가 아닙니다.",
    sources: ["agents/www/review-policy.json", "scripts/workflow/review.ts", "docs/skills/WORKFLOW.md"],
  },
  {
    id: "github", title: "GitHub 공유 원본", subtitle: "후속 방향 · 코드와 작업 기록", group: "future", x: 40, y: 820,
    description: "승인해 게시한 코드와 구조화 작업 기록을 기기 사이의 공유 원본으로 사용하는 방향입니다. 현재 앱의 자동 동기화나 게시 기능을 뜻하지 않습니다.",
    sources: ["docs/PRODUCT.md"],
  },
  {
    id: "index", title: "Mac mini 색인", subtitle: "후속 방향 · 검증과 API", group: "future", x: 330, y: 820,
    description: "지정 브랜치를 수집·검증·색인해 재현 가능한 API 보기를 제공하는 목표입니다. 현재 서버·DB·색인 연결은 구현 완료 범위가 아닙니다.",
    sources: ["docs/PRODUCT.md"],
  },
  {
    id: "views", title: "공유 보기", subtitle: "후속 방향 · Roadmap / Canvas", group: "future", x: 620, y: 820,
    description: "서버가 색인한 공유 기록을 Roadmap / Node / Canvas로 탐색하는 장기 방향입니다. 지금 보는 로컬 구조 안내 지도와 향후 서버 기반 보기는 서로 다른 범위입니다.",
    sources: ["docs/PRODUCT.md"],
  },
  {
    id: "hooks", title: "호스트 훅", subtitle: "후속 방향 · 검토 시점 알림", group: "future", x: 910, y: 820,
    description: "추후 연결하면 검토 시점을 알리거나 실행을 요청하는 트리거입니다. 검토 정책과 완료 판단은 공유 core가 소유합니다. 이 저장소의 개발 검토 자동 훅이 설치됐다고 가정하지 않습니다.",
    sources: ["docs/ARCHITECTURE.md", "docs/skills/WORKFLOW.md"],
  },
];

export const ecosystemEdges: EcosystemEdge[] = [
  { from : "chat"       , to : "bridge"     , label : "사용자 요청"                        },
  { from : "bridge"     , to : "main"       , label : "허용된 IPC"                         },
  { from : "main"       , to : "native"     , label : "JSON-RPC"                           },
  { from : "native"     , to : "projection" , label : "응답·실행 사건"                     },
  { from : "projection" , to : "chat"       , label : "화면 블록"                          },
  { from : "role"       , to : "skills"     , label : "필요한 단계 선택"                   },
  { from : "skills"     , to : "host"       , label : "절차·권한 전달"                     },
  { from : "host"       , to : "core"       , label : "실행·검사 연결"                     },
  { from : "core"       , to : "work"       , label : "접수·상태 기록"                     },
  { from : "work"       , to : "evidence"   , label : "수용 기준 검사"                     },
  { from : "evidence"   , to : "documents"  , label : "현행 문서 대조"                     },
  { from : "documents"  , to : "review"     , label : "독립 검토 대상"                     },
  { from : "review"     , to : "core"       , label : "완료 판정 근거"                     },
  { from : "main"       , to : "core"       , label : "개발 작업 조회"                     },
  { from : "work"       , to : "github"     , label : "명시 승인 후 게시" , planned : true },
  { from : "github"     , to : "index"      , label : "브랜치 수집"       , planned : true },
  { from : "index"      , to : "views"      , label : "색인 API"          , planned : true },
  { from : "hooks"      , to : "review"     , label : "검토 실행 트리거"  , planned : true },
];

export function matchingNodes(query: string, group: EcosystemGroup | "all"): EcosystemNode[] {
  const term = query.trim().toLocaleLowerCase("ko-KR");
  return ecosystemNodes.filter((node) => (group === "all" || node.group === group)
    && [node.title, node.subtitle, node.description, ...node.sources].join(" ").toLocaleLowerCase("ko-KR").includes(term));
}

export function nodeConnections(id: string): { edge: EcosystemEdge; node: EcosystemNode; outgoing: boolean }[] {
  return ecosystemEdges.filter((edge) => edge.from === id || edge.to === id).map((edge) => {
    const outgoing = edge.from === id;
    return { edge, outgoing, node: ecosystemNodes.find((node) => node.id === (outgoing ? edge.to : edge.from))! };
  });
}
