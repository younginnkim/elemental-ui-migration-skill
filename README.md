## elemental-ui-migration-skill

Flutter 앱 코드를 Plover(`package:plover`) / elutter(`package:elutter`)에서 Elemental UI(`package:elemental`)로 마이그레이션하는 Claude Code 스킬.

</br>

### 사용법

```
/migrate-from-plover lib/views/home_view.dart
/migrate-from-plover lib/
/migrate-from-plover # 원하는 프롬프트 입력
```

</br>

### 클라이언트 등록 (`~/.claude.json`)

```json
"mcpServers": {
  "elemental-ui-migration": {
    "type": "http",
    "url": "http://10.157.70.184:8000/mcp"
  },
  "elemental-ui": {
    "type": "http",
    "url": "http://10.157.70.206:3030/mcp"
  }
}
```


인자 없이 실행하면 IDE에서 열린 파일 또는 `lib/`를 대상으로 동작합니다.

</br>

### 구성

```
skills/migrate-from-plover/SKILL.md   # Claude Code 스킬
```

위젯 매핑·deprecated·파라미터 변경 정보는 이 레포에 두지 않고 **외부 HTTP MCP 서버**가 제공합니다. 스킬은 아래 두 서버를 호출합니다.

</br>

### 의존 MCP 서버

스킬은 두 개의 HTTP MCP 서버를 사용합니다. 둘 다 한 곳에 띄워져 있어 사용자는 URL만 등록하면 됩니다 (npm 실행·빌드 불필요).

| 서버 | 주요 툴 | 역할 |
|---|---|---|
| `elemental-ui-migration` | `getWidgetDetail(name)` | Plover/elutter 위젯·클래스의 마이그레이션 상세 (대상 이름, 파라미터 변경, breaking change, 노트) |
| `elemental-ui` | `getWidget`, `listWidgets`, `matchWidget`, `getPatterns`, `getFocusRules`, `getDesignTokens` | Elemental UI 위젯의 현재 파라미터·패턴·포커스 규칙 등 메타데이터 |
