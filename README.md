# elemental-ui-migration-skill

Flutter 앱 코드를 Plover(`package:plover`)에서 Elemental UI(`package:elutter`)로 마이그레이션하는 Claude Code 스킬 + MCP 서버.

## 구성

```
.claude/skills/migrate-from-plover/   # Claude Code 스킬
elemental-ui-migration/               # MCP 서버 (Node.js)
```

## 사용법

```
/migrate-from-plover lib/views/home_view.dart
/migrate-from-plover lib/views/
/migrate-from-plover lib/
```

인자 없이 실행하면 IDE에서 열린 파일 또는 `lib/`를 대상으로 동작합니다.

## MCP 서버 툴

| 툴 | 설명 |
|---|---|
| `scanDartFile` | Dart 파일/디렉토리에서 Plover 사용 스캔 |
| `listWidgetMappings` | 전체 위젯 매핑 목록 조회 |
| `getWidgetMigration` | 특정 위젯의 마이그레이션 상세 정보 |
| `getBreakingChanges` | 수동 처리가 필요한 breaking change 목록 |

## 설치

```bash
# MCP 서버 빌드
cd elemental-ui-migration
npm install
npm run build
```

`~/.claude.json`에 MCP 서버가 등록되어 있어야 합니다:

```json
"mcpServers": {
  "elemental-ui-migration": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/elemental-ui-migration-skill/elemental-ui-migration/build/index.js"]
  }
}
```
