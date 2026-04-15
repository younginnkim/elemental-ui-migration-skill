# plover-migration — MCP + Skill 문서

Flutter 앱의 `package:plover` 의존성을 `package:elutter` (Elemental UI)로 마이그레이션하는 도구입니다.
Claude Code의 `/migrate-plover` 스킬과 `plover-migration` MCP 서버로 구성됩니다.

---

## 전체 구조

```
사용자
  │
  │  /migrate-plover [경로]
  ▼
┌─────────────────────────────────────────┐
│         Claude Code (AI Agent)          │
│  ~/.claude/skills/migrate-plover/       │
│                SKILL.md                 │
│                                         │
│  Step 1: Scan  ──────────────────────┐  │
│  Step 2: Breaking changes  ───────┐  │  │
│  Step 3: Apply migrations         │  │  │
│  Step 4: TV focus rule check      │  │  │
│  Step 5: Report                   │  │  │
└───────────────────────────────────┼──┼──┘
                                    │  │
                MCP 호출             │  │
                                    ▼  ▼
┌──────────────────────────────────────────┐
│       plover-migration MCP Server        │
│  node .../plover-migration-mcp/build/    │
│                                          │
│  ┌────────────────┐  ┌────────────────┐  │
│  │  scanDartFile  │  │ getBreaking    │  │
│  │                │  │ Changes        │  │
│  │  scanner.ts    │  │                │  │
│  └────────────────┘  └────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  │
│  │ getWidget      │  │ listWidget     │  │
│  │ Migration      │  │ Mappings       │  │
│  │                │  │                │  │
│  └────────────────┘  └────────────────┘  │
│                                          │
│  mapping.ts: 위젯 매핑 테이블 (120+ 항목)  │
└──────────────────────────────────────────┘
                    │
                    │ 파일 직접 수정 (Edit tool)
                    ▼
         프로젝트 Dart 소스 파일
```

---

## 스킬 실행 흐름

```
/migrate-plover [경로 or IDE 열린 파일 or lib/]
        │
        ▼
┌───────────────────────────────────┐
│ Step 1: 대상 경로 스캔             │
│                                   │
│  scanDartFile({ path })           │
│    ├─ .dart 파일 재귀 탐색         │
│    ├─ package:plover import 감지  │
│    ├─ Plover 식별자 위치 추출      │
│    └─ breaking change 여부 표시   │
└───────────────┬───────────────────┘
                │ 결과: ScanResult[]
                ▼
┌───────────────────────────────────┐
│ Step 2: Breaking Change 사전 조회  │
│                                   │
│  getBreakingChanges()             │
│    └─ ⚠ 위젯 목록 + paramChanges  │
│                                   │
│  getWidgetMigration({ name })     │
│    └─ 파라미터 diff 상세 조회      │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Step 3: 파일 수정                  │
│                                   │
│  1. import 교체                   │
│     package:plover → package:elutter│
│                                   │
│  2. 위젯/enum 이름 변경            │
│     W접두사 → E접두사             │
│                                   │
│  3. 파라미터 변경 적용             │
│     (breaking change 위젯만)      │
│                                   │
│  4. 자동변환 불가 항목 TODO 태그   │
│     // TODO(migrate): <reason>    │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Step 4: TV 포커스 규칙 검증        │
│                                   │
│  critical                         │
│  ├─ focus-passthrough             │
│  │   EVirtualList.itemBuilder →   │
│  │   focusNode을 child에 전달      │
│  └─ no-nested-efocusable          │
│      내부 포커스 위젯 + EFocusable │
│      중첩 금지                    │
│                                   │
│  warning                          │
│  ├─ delegate-focus-events         │
│  └─ popup-focus-restore           │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Step 5: 리포트 출력                │
│                                   │
│  - 수정된 파일 수                  │
│  - 교체된 식별자 총 수             │
│  - 수동 처리한 breaking change    │
│  - 남은 TODO(migrate) 항목        │
└───────────────────────────────────┘
```

---

## MCP 서버

**위치:** `~/project/AI/AI_MCP/plover-migration-mcp/`  
**실행:** `node build/index.js` (stdio transport)  
**등록:** `~/.claude/settings.json` → `mcpServers`

### 소스 구조

```
src/
├── index.ts      # MCP 서버 진입점 — 4개 tool 등록
├── mapping.ts    # 위젯 매핑 테이블 + 파라미터 변경 정의
└── scanner.ts    # Dart 파일 파싱 및 Plover 식별자 스캔
```

### Tool 목록

| Tool | 입력 | 출력 |
|---|---|---|
| `scanDartFile` | `path: string` | `ScanResult[]` — 파일별 위젯 사용 현황 |
| `getBreakingChanges` | 없음 | breaking change 위젯 목록 + paramChanges |
| `getWidgetMigration` | `name: string` | 특정 위젯 매핑 + 파라미터 diff |
| `listWidgetMappings` | `breakingOnly?: boolean` | 전체 또는 breaking-only 매핑 테이블 |

### 데이터 구조

```typescript
// scanner.ts
interface ScanResult {
  filePath: string;
  hasPloverImport: boolean;
  importLines: number[];        // import 문 줄 번호
  widgetsFound: WidgetUsage[];
  breakingChangeCount: number;
  summary: string;
}

interface WidgetUsage {
  name: string;        // 원본 Plover 식별자 (e.g. WButton)
  target: string;      // 대상 Elemental UI 식별자 (e.g. EButton)
  lines: number[];     // 등장한 줄 번호들
  breakingChange: boolean;
  notes?: string;
}

// mapping.ts
interface WidgetMapping {
  target: string;
  breakingChange?: boolean;
  notes?: string;
}

interface ParamChange {
  removed?: string[];             // 삭제된 파라미터
  renamed?: Record<string, string>; // 이름 변경된 파라미터
  added?: string[];               // 추가된 파라미터
  notes?: string;
}
```

---

## Breaking Change 위젯 요약

| Plover | Elemental UI | 핵심 변경사항 |
|---|---|---|
| `WButton` | `EButton` | `child` → `text` / `buildChildWidget` |
| `WVirtualList` | `EVirtualList` | itemBuilder에 `focusNode` 인자 추가, `itemHeight` 필수 |
| `WSpinner` | `ESpinner` | `blockClickOn` → `block`, `content` → `message` |
| `WSwitchItem` | `ESwitchItem` | `children` 지원 제거 |

---

## 패키지 정보

| | Plover | Elemental UI |
|---|---|---|
| 패키지명 | `package:plover` | `package:elutter` |
| 버전 | v0.7.86 | v1.0.0 |
| 소스 경로 | `~/project/Elemental_UI/flutter_app_components/lib/` | `~/project/Elemental_UI/elemental_widgets/lib/elutter/` |

---

## 사용 예시

```
# 특정 파일 마이그레이션
/migrate-plover lib/views/home_view.dart

# 특정 디렉터리 마이그레이션
/migrate-plover lib/views/

# 전체 lib 마이그레이션
/migrate-plover lib/

# 인자 없음 → IDE에서 현재 열린 파일 대상
/migrate-plover
```
