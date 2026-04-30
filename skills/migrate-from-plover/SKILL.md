---
name: migrate-from-plover
description: Flutter 앱을 Plover(package:plover)에서 Elemental UI(package:elutter)로 마이그레이션합니다.
argument-hint: "[dart_file_or_directory]"
---

# /migrate-from-plover

Plover 위젯 라이브러리(`package:plover`)를 사용하는 Flutter Dart 코드를 Elemental UI(`package:elutter`)로 마이그레이션합니다.
import 교체, 위젯 이름 변경, enum 이름 변경, 파라미터 변경(breaking change 포함)을 자동 처리합니다.

위젯 매핑·deprecated 정보·파라미터 변경 정보는 모두 `elemental-ui-migration-mcp.getWidgetDetail(name)` MCP 툴이 단일 진실 공급원(single source of truth)으로 제공합니다 — 이 문서에는 매핑 표를 중복으로 두지 않습니다.

## 사용법

```
/migrate-from-plover <dart_file_or_directory>
```

**예시:**
```
/migrate-from-plover lib/views/home_view.dart
/migrate-from-plover lib/views/
/migrate-from-plover lib/
```

**입력:** `$ARGUMENTS` — Dart 파일 또는 디렉토리 경로. 비어 있으면 IDE에서 열린 파일 사용; 그것도 없으면 `lib/`로 fallback.

**중요:** 사용자에게 범위 축소(scoped/dry-run/부분 마이그레이션) 여부를 묻지 말 것. 입력 경로 전체에 대해 즉시 full migration을 진행한다. pubspec에서 plover 제거는 정상 흐름이며 되돌리지 말 것 (Step 1-1 참조).

---

## 단계

순서대로 실행. 각 단계를 완료한 뒤 다음으로 넘어갈 것.

### Step 1 — Plover 사용 감지 (컴파일러 기반)

**1-1. pubspec.yaml 수정** — 두 변경을 한 번의 Edit으로 적용.

1. `dependencies:`에서 `plover:` 제거
2. `elemental:` git dependency 추가 (기존에 elutter 존재한다면 교체):
```yaml
  elemental:
    git:
      url: ssh://wall.lge.com/module/elutter # elemental_ui로 변경 계획
      ref: main
```
이 단계는 마이그레이션의 일부 — 되돌리지 말 것.

**1-2. 의존성 새로고침 및 버전 충돌 해결**

최대 5회 반복:
```
flutter pub get 2>&1
```
`flutter`가 없으면 `dart pub get 2>&1`로 fallback.

- **성공** → 다음 단계로
- **실패 + "version solving failed"**:
  - 에러에서 충돌 패키지명과 elutter가 요구하는 버전을 파싱.
    예: `Because myapp depends on flutter_lints ^2.0.0 and elutter depends on flutter_lints ^3.0.0`
    → `flutter_lints`를 `^3.0.0`으로 갱신
  - pubspec.yaml의 제약을 elutter 요구 버전으로 교체하고 재시도.
- **5회 후에도 실패** → 에러 출력 후 중단. 사용자에게 수동 해결 요청.

**1-3. 컴파일러 에러 수집**
```
flutter analyze --format=machine 2>&1
```
`flutter`가 없으면 `dart analyze --format=machine 2>&1`로 fallback.

Plover 관련 에러만 필터링:
- `URI_DOES_NOT_EXIST` → import 라인 (Step 2-1 대상)
- `UNDEFINED_CLASS`, `UNDEFINED_IDENTIFIER` → 위젯/enum 사용 라인

Machine-format 예:
```
ERROR|COMPILE_TIME_ERROR|URI_DOES_NOT_EXIST|lib/views/home.dart|1|8|46|The import target doesn't exist.
ERROR|COMPILE_TIME_ERROR|UNDEFINED_CLASS|lib/views/home.dart|45|5|7|Undefined class 'WButton'.
ERROR|COMPILE_TIME_ERROR|UNDEFINED_IDENTIFIER|lib/views/home.dart|46|3|12|Undefined name 'WAlertType'.
```
필드 순서: `severity|type|code|file|line|col|length|message`

에러가 0개면 Plover 미사용 — 중단.

**1-4. 위젯 이름 추출 및 매핑 조회**
- `UNDEFINED_CLASS` / `UNDEFINED_IDENTIFIER` 메시지의 single quote 안 식별자를 파싱.
  예: `Undefined class 'WButton'` → `WButton`
- 각 unique 식별자마다 `elemental-ui-migration-mcp.getWidgetDetail(name)` 호출
  → `target`, `breakingChange`, `deprecated`, `deprecatedNote`, `notes`, `paramChanges` 반환.

  **결과는 Step 2 전체에서 재사용 — 캐시할 것.**

  교체 이름은 항상 응답의 `target` 필드를 사용 — `W→E` prefix 규칙으로 추론 금지
  (예: `WFullScreenPopup` → `EWizardPanels`, `EFullScreenPopup` 아님).

**1-5. 결과 구조화** (파일별로 묶음, Step 2 입력으로 사용)
```
{
  "lib/views/home.dart": [
    { widget: "WButton", line: 45, target: "EButton", breakingChange: true },
    { widget: "WAlert",  line: 52, target: "EAlert",  breakingChange: false },
  ],
  ...
}
```

### Step 2 — 마이그레이션 적용

각 Plover 사용 파일에 대해 아래 순서로 변경 적용.
**파일 Read 최소화.** Step 1이 이미 라인 번호를 제공 — 파일 전체를 읽지 말 것.

**2-1. import 교체** (Read 불필요)
- Plover barrel import는 항상 동일 — 바로 Edit:
  - `old_string: "import 'package:plover/plover.dart';"` → `new_string: "import 'package:elemental/widgets.dart';"`

**2-2. 위젯 / enum 이름 교체**
- Step 1-4에서 받은 결과의 `target` 필드를 교체 이름으로 사용.
- `deprecated: false`: `replace_all: true`로 Edit (Read 불필요)
  - 예: `old_string: "WButton"`, `new_string: "EButton"`, `replace_all: true`
- `deprecated: true`:
  - `getWidgetDetail()` 결과의 `deprecatedNote`에서 권장 대체 위젯 확인.
  - 추가로 `elemental-ui-mcp.getWidget(target)` 호출 → `aliases` 필드로 후보 보강.
  - **대체 위젯이 있으면**:
    - `elemental-ui-mcp.getWidget(alternative_name)` 호출 → 대체 위젯의 전체 파라미터 목록 획득.
    - 각 라인에 대해 `Read({ file_path: path, offset: line - 5, limit: 11 })` 호출 (라인 여러 개면 병렬) — deprecated 위젯의 생성자 호출부 확인.
    - 파라미터 매핑: deprecated 위젯 params → 대체 위젯 params (1:1).
      - 이름 변경된 params → 새 이름 사용.
      - 대체 위젯에 없는 params → `// TODO(migrate): <paramName> removed` 주석.
      - 자동 매핑 불가능한 구조적 차이 → `// TODO(migrate): manual refactor needed`.
    - 위젯 이름 + params를 대체 코드로 교체 (완전 매핑 시 TODO 없음).
    - 관련 컨트롤러 클래스도 함께 교체 (예: `ETabController` → `ETabLayoutController`).
  - **대체 위젯이 없으면** (`deprecatedNote`가 "manual refactor" 등으로 명시):
    - Pass 1 (rename): Plover 이름 → Elemental UI 이름, `replace_all: true`.
    - Pass 2 (생성자 호출에만 TODO): `old_string: "EXxx("` → `new_string: "EXxx( // TODO(migrate): no direct replacement — manual refactor"`, `replace_all: true`.
    - 타입 어노테이션 (`EXxx? x`)은 Pass 1만 적용 — 의도된 동작.

**2-3. breaking change 위젯의 파라미터 변경**
- Step 1-4 캐시에서 해당 위젯의 `paramChanges` 필드 사용:
  - `removed`: 제거된 파라미터 목록
  - `renamed`: `{ 옛이름: 새이름 }` 매핑
  - `added`: 새로 추가된 파라미터
  - `notes`: 시그니처/기본값 변경 등 자유 형식 설명
- breaking change가 있는 파일은 Step 1의 라인 번호로 `Read({ file_path: path, offset: line - 5, limit: 11 })` 호출 (파일별 병렬).
- 반환된 내용에서 `old_string`을 구성해 정밀 Edit 적용.

**2-4. 수동 처리 항목 마킹**
- Step 1의 라인 번호로 `Read({ file_path: path, offset: line - 5, limit: 11 })` 호출 (파일별 병렬).
- 반환된 내용에서 `old_string`을 구성해 `// TODO(migrate): <reason>` 주석 추가.

**2-5. 새 위젯 기준 파라미터 검증 (rename 후 sweep)**

2-1 ~ 2-4가 **모든 파일**에 대해 완료된 후, 정적 매핑이 잡지 못한 제거/이름변경된 파라미터들이 컴파일 에러로 나타남. analyze 1회로 찾아내고 대체 제안과 함께 주석 처리.

1. `flutter analyze --format=machine` 재실행 (없으면 `dart analyze`로 fallback). `UNDEFINED_NAMED_PARAMETER`만 필터. 각 항목은 `file|line|col`과 `The named parameter 'centered' isn't defined.` 형식 메시지를 제공 — single quote 안 파라미터명 추출.

2. 파일별, 그리고 enclosing 위젯 호출부별로 그룹화. 위젯명 찾기: `Read({ file_path: path, offset: errorLine - 5, limit: 11 })` 호출 후 위로 올라가며 `E<Name>(`를 찾을 때까지 탐색.

3. 모든 hit에 등장한 unique target 위젯마다 `elemental-ui-mcp.getWidget(<name>)`을 **1회씩** 호출 (캐시) → 현재 파라미터 목록과 설명 획득.

4. 각 (file, line)의 제거된 param마다:
   - 해당 라인에 이미 `// TODO(migrate)`가 있으면 **skip** — 재실행 멱등성.
   - single-line vs multi-line 판단:
     - **single-line** (`paramName: value,`가 한 줄에 들어맞음): `paramName: value,` 전체를 `/* */`로 감쌈.
     - **multi-line** (값이 여러 줄, 예: 중첩 위젯): `paramName` 뒤의 `:`부터 시작해 `(`/`)`/`{`/`}`/`[`/`]` 균형을 맞춰 매칭되는 trailing `,` (또는 마지막 param이면 닫는 `)`)까지 탐색. `paramName:`부터 trailing `,`까지 전체 표현식을 `/* */`로 감쌈.
   - 주석 처리된 영역 **바로 위 라인**에 다음 삽입:
     ```
     // TODO(migrate): `<paramName>` removed — consider `<alt>`
     ```
     `<alt>`는 제거된 param의 이름 + 값 의미를 새 위젯 param 설명(getWidget 결과)과 비교해 선택. 가장 가까운 의미 매칭이 있으면 사용 (예: `centered: true` → `alignment: Alignment.center`); 없으면 `no direct replacement`.

5. 모든 edit 후 `flutter analyze --format=machine` 1회 더 실행해 잔여 `UNDEFINED_NAMED_PARAMETER` 카운트 기록. `/* */`가 제거된 param을 무력화하므로 0이어야 함; 0이 아니면 주석 처리가 잘못된 것 — 수동 검토 필요. 이 숫자를 Step 5로 전달.

**Output 예시:**

```dart
// before
ESwitchItem(
  centered: true,
  slotBefore: SomeWidget(
    child: Text('label'),
  ),
  value: isOn,
)

// after
ESwitchItem(
  // TODO(migrate): `centered` removed — consider `alignment: Alignment.center`
  /* centered: true, */
  // TODO(migrate): `slotBefore` removed — wrap parent in `EItem` to attach a leading widget
  /* slotBefore: SomeWidget(
    child: Text('label'),
  ), */
  value: isOn,
)
```

### Step 3 — App Foundation 마이그레이션 (EApp + EAppMain)

앱 레벨 구조(Plover에는 없음)를 Elemental UI 표준 패턴으로 변환.

**3-1. 진입점 찾기**

다음 둘 중 하나로 식별:
```
find lib/ -name "main.dart"
grep -rl "void main()" lib/ --include="*.dart"
```
`runApp(` 사용 여부 확인. 없으면 이 Step skip.

파일을 읽어 `runApp` 호출 위치 파악:
- **Pattern A**: `runApp`이 `main()` 최상위에서 직접 호출됨 → `EAppMain.run`으로 변환 가능.
- **Pattern B**: `runApp`이 callback/listener/Future 안에 중첩됨 → `EAppMain.run` 적용 불가; `EApp`만 삽입.

**3-2. 패턴 및 파라미터 조회**

진입점이 있을 때만:
- `elemental-ui-mcp.getPatterns(keyword: 'App Entry Point')` → 표준 변환 패턴
- `elemental-ui-mcp.getWidget('EApp')` → EApp 전체 파라미터
- `elemental-ui-mcp.getWidget('EAppMain')` → EAppMain.run 사용법

**3-3. 진입점 변환**

패턴별 처리.

**Pattern A — `EAppMain.run`으로 변환** (`runApp`이 `main()` 최상위에서 호출):

```dart
// before
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

// after
void main() => EAppMain.run(const EApp(child: MyApp()));
```

i18n (`LocalizationDelegate`) 사용 시 → `EAppMain.run(EApp(...), i18nPath: 'assets/i18n', fallbackLocale: 'en')`로 교체.

**Pattern B — `EApp` 삽입** (`runApp`이 callback/listener에 중첩):

`EAppMain.run` 사용 불가. 기존 `runApp` 호출 지점에 `EApp` 삽입:

```dart
// before
runApp(ProviderScope(child: LocalizedApp(delegate, const App())));

// after — App 위젯 바로 주변에 EApp 삽입
runApp(ProviderScope(child: LocalizedApp(delegate, EApp(child: const App()))));
```

i18n 마이그레이션(LocalizationDelegate → EApp 내장)은 비동기 init 흐름 재작성이 필요 — 주석으로 남길 것:
```dart
// TODO(migrate): complex async init — EAppMain.run not applicable.
//   Consider restructuring to use EAppMain.run with i18nPath/fallbackLocale
//   after refactoring the ProviderContainer listener pattern.
```

**3-4. MaterialApp 파라미터 이동**

앱 위젯 안에 `MaterialApp(...)`이 있으면 그 파라미터들을 처리:

| MaterialApp param | 처리 |
|---|---|
| `locale` | EApp으로 이동 |
| `localizationsDelegates` | EApp으로 이동 |
| `supportedLocales` | EApp으로 이동 (가능하면 EAppMain.run의 `supportedLocales` 사용) |
| `theme`, `darkTheme` | EApp으로 이동 |
| `debugShowCheckedModeBanner` | 제거 (EApp이 처리) |
| `home`, `routes`, `onGenerateRoute` 등 | child 안에 유지 + `// TODO(migrate): routing stays in child — EApp does not manage navigation` 주석 |

**3-5. import 확인**

Step 2에서 `import 'package:elemental/widgets.dart';`가 추가됐는지 확인. 없으면 추가.

---

### Step 4 — TV 포커스 규칙 검증

마이그레이션 후 파일별로 다음 규칙 검증. 전체 규칙은 `elemental-ui-mcp.getFocusRules()`로 조회:

| 규칙 | 심각도 | 검사 |
|---|---|---|
| `focus-passthrough` | **critical** | `EVirtualList.itemBuilder`가 자식 위젯에 `focusNode`를 전달 |
| `no-nested-efocusable` | **critical** | 내부 포커스를 가진 위젯이 `EFocusable`로 감싸지지 않음 |
| `delegate-focus-events` | warning | 관찰 전용 `EFocusable`은 `focusOnTap: false, tapByEnter: false` |
| `popup-focus-restore` | warning | 팝업 닫힐 때 포커스 복원 |

### Step 5 — 리포트

다음 항목을 표로 출력:
- 수정된 파일 수
- 교체된 식별자 총 개수
- 수동 편집이 필요한 breaking change 개수
- deprecated target으로 rename된 위젯 개수 (`@Deprecated` Elemental UI 타겟으로 변경된 항목)
- Step 2-5에서 자동 주석 처리된 파라미터 개수 + `<widget>.<param>` 샘플
- Step 2-5 마지막 analyze에서 잔여 `UNDEFINED_NAMED_PARAMETER` 개수 (0이어야 함; 0이 아니면 수동 검토 필요)
- 잔여 `// TODO(migrate):` 항목 개수
