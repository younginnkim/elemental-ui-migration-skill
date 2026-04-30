---
name: migrate-from-plover
description: Migrate Flutter app code from Plover (package:plover) to Elemental UI (package:elutter). Replaces imports, widget names, enums, and parameters.
argument-hint: "[dart_file_or_directory]"
---

# /migrate-from-plover

Migrate Flutter Dart code from the Plover widget library (`package:plover`) to Elemental UI (`package:elutter`).

Handles import replacement, widget renaming (per mapping table), enum renaming, and parameter changes (including breaking changes).

## Usage

```
/migrate-from-plover <dart_file_or_directory>
```

**Examples:**
```
/migrate-from-plover lib/views/home_view.dart
/migrate-from-plover lib/views/
/migrate-from-plover lib/
```

**Input:** `$ARGUMENTS` — Dart file or directory path. If empty, use the currently open file in the IDE; if none, fall back to `lib/`.

---

## Steps

Run in order. Complete each step before moving to the next.

### Step 1 — Detect Plover usage (compiler-based)

**1-1. Edit pubspec.yaml** — apply both changes in a single Edit.

1. Remove `plover:` from `dependencies:`
2. Add `elutter:` git dependency (skip if already present):
```yaml
  elutter:
    git:
      url: ssh://wall.lge.com/module/elutter
      ref: develop
```
This step is part of the migration; do not revert.

**1-2. Refresh dependencies and resolve version conflicts**

Loop up to 5 times:
```
flutter pub get 2>&1
```
Fall back to `dart pub get 2>&1` if `flutter` is not available.

- **Success** → proceed to next step
- **Failure + "version solving failed"**:
  - Parse the conflicting package name and the version elutter requires from the error.
    Example: `Because myapp depends on flutter_lints ^2.0.0 and elutter depends on flutter_lints ^3.0.0`
    → update `flutter_lints` to `^3.0.0`
  - Replace the constraint in pubspec.yaml with the version elutter requires and retry.
- **Still failing after 5 tries** → print the error and stop. Ask the user to resolve manually.

**1-3. Collect compiler errors**
```
flutter analyze --format=machine 2>&1
```
Fall back to `dart analyze --format=machine 2>&1` if `flutter` is unavailable.

Filter Plover-related errors only:
- `URI_DOES_NOT_EXIST` → import line (target of Step 2-1)
- `UNDEFINED_CLASS`, `UNDEFINED_IDENTIFIER` → widget/enum usage lines

Machine-format example:
```
ERROR|COMPILE_TIME_ERROR|URI_DOES_NOT_EXIST|lib/views/home.dart|1|8|46|The import target doesn't exist.
ERROR|COMPILE_TIME_ERROR|UNDEFINED_CLASS|lib/views/home.dart|45|5|7|Undefined class 'WButton'.
ERROR|COMPILE_TIME_ERROR|UNDEFINED_IDENTIFIER|lib/views/home.dart|46|3|12|Undefined name 'WAlertType'.
```
Field order: `severity|type|code|file|line|col|length|message`

If zero errors, the project uses no Plover — stop.

**1-4. Extract widget names and look up mapping**
- Parse identifiers inside single quotes from `UNDEFINED_CLASS` / `UNDEFINED_IDENTIFIER` messages.
  Example: `Undefined class 'WButton'` → `WButton`
- For each unique identifier, call `getWidgetDetail(name)`
  → returns `target`, `breakingChange`, `deprecated`, `notes`.

**1-5. Structure the result** (grouped by file, used as Step 2 input)
```
{
  "lib/views/home.dart": [
    { widget: "WButton", line: 45, target: "EButton", breakingChange: true },
    { widget: "WAlert",  line: 52, target: "EAlert",  breakingChange: false },
  ],
  ...
}
```

### Step 2 — Apply migration

Apply changes in the order below for each file with Plover usage.
**Minimize file Reads.** Step 1 already provides line numbers — don't Read the whole file.

**2-1. Replace import** (no Read needed)
- Plover barrel import is always the same string — Edit directly:
  - `old_string: "import 'package:plover/plover.dart';"` → `new_string: "import 'package:elutter/elutter.dart';"`

**2-2. Replace widget and enum names**
- For each identifier in the Step 1 result, use the `target` field as the replacement name.
  Do NOT infer via the W→E prefix rule (e.g., `WFullScreenPopup` → `EWizardPanels`, not `EFullScreenPopup`).
- `deprecated: false`: Edit with `replace_all: true` (no Read needed)
  - Example: `old_string: "WButton"`, `new_string: "EButton"`, `replace_all: true` ← `new_string` is always the `target` from the scan result
- `deprecated: true`:
  - Call `elemental-ui-mcp.getWidget(target)` → check `deprecated`, `deprecatedNote`, `aliases` for the recommended alternative.
  - **If an alternative exists** (listed in `aliases` or in the deprecated table below):
    - Call `elemental-ui-mcp.getWidget(alternative_name)` → get the alternative's full parameter list.
    - Use `Read({ file_path: path, offset: line - 5, limit: 11 })` for each line to see the deprecated widget's constructor call site (call in parallel for multiple lines).
    - Map parameters: deprecated widget params → alternative widget params 1:1.
      - Renamed params → use the new name.
      - Params missing in the alternative → annotate `// TODO(migrate): <paramName> removed`.
      - Structural mismatch preventing auto-mapping → add `// TODO(migrate): manual refactor needed`.
    - Replace widget name + params with complete alternative code (no TODO when fully mapped).
    - Replace related controller classes too (e.g., `ETabController` → `ETabLayoutController`).
  - **If no alternative exists** (table below says "manual refactor"):
    - Pass 1 (rename): Plover name → Elemental UI name, `replace_all: true`.
    - Pass 2 (TODO on constructor calls only): `old_string: "EXxx("` → `new_string: "EXxx( // TODO(migrate): no direct replacement — manual refactor"`, `replace_all: true`.
    - Type annotations (`EXxx? x`) receive Pass 1 only, renamed without TODO — intended behavior.

**2-3. Parameter changes for breaking-change widgets**
- Param diffs are in the [Parameter changes](#parameter-changes) section — `getWidgetDetail()` not required.
- For files with breaking changes, `Read({ file_path: path, offset: line - 5, limit: 11 })` for each line from Step 1 (parallelize per file).
- Build `old_string` from the returned content and apply a targeted Edit.

**2-4. Mark manual-handling items**
- `Read({ file_path: path, offset: line - 5, limit: 11 })` for each line from Step 1 (parallelize per file).
- Build `old_string` from the returned content and Edit to add `// TODO(migrate): <reason>`.

**2-5. Validate parameters against new widget (post-rename sweep)**

After 2-1 ~ 2-4 complete for **all files**, removed/renamed parameters that the static mapping didn't catch will surface as compile errors. Run a single analyze pass to find them and comment them out with a suggested alternative.

1. Re-run `flutter analyze --format=machine` (fall back to `dart analyze`). Filter `UNDEFINED_NAMED_PARAMETER` only. Each entry gives `file|line|col` and a message of the form: `The named parameter 'centered' isn't defined.` — extract the param name from the single quotes.

2. Group hits by file and by enclosing widget call site. To find the widget name: `Read({ file_path: path, offset: errorLine - 5, limit: 11 })` and walk upward until you hit `E<Name>(`.

3. For each unique target widget across all hits, call `elemental-ui-mcp.getWidget(<name>)` **once** (cache the result) to get the current parameter list with descriptions.

4. For each removed param at (file, line):
   - **Skip** if the line already contains `// TODO(migrate)` — idempotent against re-runs.
   - Decide single-line vs multi-line:
     - **Single-line** (`paramName: value,` fits on one line): wrap the entire `paramName: value,` in `/* */`.
     - **Multi-line** (value spans multiple lines, e.g. nested widget): starting at the `:` after `paramName`, balance `(`/`)`/`{`/`}`/`[`/`]` to find the matching trailing `,` (or the closing `)` if it's the last param). Wrap the full expression — from `paramName:` through the trailing `,` — in `/* */`.
   - On the line **immediately above** the commented-out region, insert:
     ```
     // TODO(migrate): `<paramName>` removed — consider `<alt>`
     ```
     where `<alt>` is chosen by comparing the removed param's name + value semantics against the new widget's param descriptions from getWidget. Pick the closest semantic match if there is one (e.g. `centered: true` → `alignment: Alignment.center`); otherwise use `no direct replacement`.

5. After all edits, run `flutter analyze --format=machine` once more and record the remaining `UNDEFINED_NAMED_PARAMETER` count. The number should be 0 since `/* */` neutralizes the removed params; any non-zero count means a comment-out was malformed and needs manual review. Carry this number into Step 5.

**Output example:**

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

### Step 3 — App Foundation migration (EApp + EAppMain)

Convert app-level structure (not present in Plover) to the standard Elemental UI pattern.

**3-1. Locate entry point**

Identify the file with either:
```
find lib/ -name "main.dart"
grep -rl "void main()" lib/ --include="*.dart"
```
Check for `runApp(` usage. If absent, skip this Step.

Read the file to find where `runApp` is called:
- **Pattern A**: `runApp` is called directly at the top level of `main()` → can convert to `EAppMain.run`.
- **Pattern B**: `runApp` is nested inside a callback/listener/Future → `EAppMain.run` not applicable; insert `EApp` only.

**3-2. Look up patterns and parameters**

Only if an entry point exists:
- `elemental-ui-mcp.getPatterns(keyword: 'App Entry Point')` → canonical conversion patterns
- `elemental-ui-mcp.getWidget('EApp')` → full EApp parameter list
- `elemental-ui-mcp.getWidget('EAppMain')` → EAppMain.run usage

**3-3. Convert entry point**

Handle per pattern.

**Pattern A — convert to EAppMain.run** (`runApp` called at top of `main()`):

```dart
// before
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

// after
void main() => EAppMain.run(const EApp(child: MyApp()));
```

With i18n (`LocalizationDelegate`) → replace with `EAppMain.run(EApp(...), i18nPath: 'assets/i18n', fallbackLocale: 'en')`.

**Pattern B — insert EApp** (`runApp` nested in a callback/listener):

`EAppMain.run` cannot be used. Insert `EApp` at the existing `runApp` call:

```dart
// before
runApp(ProviderScope(child: LocalizedApp(delegate, const App())));

// after — insert EApp immediately around the App widget
runApp(ProviderScope(child: LocalizedApp(delegate, EApp(child: const App()))));
```

Migrating i18n (LocalizationDelegate → EApp built-in handling) requires rewriting the async init flow; leave a comment:
```dart
// TODO(migrate): complex async init — EAppMain.run not applicable.
//   Consider restructuring to use EAppMain.run with i18nPath/fallbackLocale
//   after refactoring the ProviderContainer listener pattern.
```

**3-4. Move MaterialApp parameters**

If `MaterialApp(...)` exists inside the app widget, handle its parameters:

| MaterialApp param | Action |
|---|---|
| `locale` | Move to EApp |
| `localizationsDelegates` | Move to EApp |
| `supportedLocales` | Move to EApp (prefer `supportedLocales` on EAppMain.run) |
| `theme`, `darkTheme` | Move to EApp |
| `debugShowCheckedModeBanner` | Remove (EApp handles it) |
| `home`, `routes`, `onGenerateRoute`, etc. | Keep inside child + add `// TODO(migrate): routing stays in child — EApp does not manage navigation` |

**3-5. Verify import**

Confirm `import 'package:elutter/elutter.dart';` was added in Step 2. If not, add it.

---

### Step 4 — TV focus rule validation

After migration, verify these rules per file. Full rules via `elemental-ui-mcp.getFocusRules()`:

| Rule | Severity | Check |
|---|---|---|
| `focus-passthrough` | **critical** | `EVirtualList.itemBuilder` forwards `focusNode` to the child widget |
| `no-nested-efocusable` | **critical** | Widgets with internal focus are not wrapped in `EFocusable` |
| `delegate-focus-events` | warning | Observation-only `EFocusable` has `focusOnTap: false, tapByEnter: false` |
| `popup-focus-restore` | warning | Focus is restored when a popup closes |

### Step 5 — Report

Print a table summary of:
- Number of modified files
- Total identifiers replaced
- Breaking changes requiring manual edits
- Widgets renamed to a deprecated target (renamed to `@Deprecated` Elemental UI target)
- Parameters auto-commented in Step 2-5 (count, plus a sample of `<widget>.<param>`)
- Remaining `UNDEFINED_NAMED_PARAMETER` count from the final analyze in Step 2-5 (should be 0 — non-zero means manual review needed)
- Remaining `// TODO(migrate):` items

---

## Widget mapping

Each Plover identifier maps to a specific Elemental UI target defined in the mapping table.
**Do NOT infer via the W→E prefix rule** — always use `target` from the scan result.
(e.g., `WFullScreenPopup` → `EWizardPanels`, `WLayeredPopup` → `EFlexiblePopupPanels`, `MediaType` → `EMediaType`)

Primary identifiers:

| Plover | Elemental UI |
|---|---|
| `WButton` | `EButton` ⚠ |
| `WAlert` | `EAlert` |
| `WItem` / `WItemBase` | `EItem` / `EItemBase` |
| `WPanel` / `WHeader` | `EPanel` / `EHeader` |
| `WPopup` | `EPopup` |
| `WCheckboxItem` | `ECheckboxItem` |
| `WRadioItem` | `ERadioItem` |
| `WSwitchItem` | `ESwitchItem` ⚠ |
| `WDropdown` | `EDropdown` |
| `WVirtualList` | `EVirtualList` ⚠ |
| `WVerticalToHorizontalWheelConverter` | `EVerticalToHorizontalWheelConverter` |
| `WSpinner` | `ESpinner` |
| `WToast` / `WToastContext` | `EToast` / `EToastContext` † |
| `WTooltip` | `ETooltip` |
| `WTabs` / `WTabController` | `ETabs` / `ETabController` † |
| `WHeading` | `EHeading` |
| `WBodyText` | `EBodyText` |
| `WInput` | `EInput` † |
| `WSlider` | `ESlider` |
| `WProgressBar` | `EProgressBar` |
| `WProgressButton` | `EProgressButton` † |
| `WIconItem` | `EIconItem` |
| `WImageItem` | `EImageItem` |
| `WMediaItem` | `EMediaItem` † |
| `WCarousel` | `ECarousel` † |
| `WAnimatedCarouselSlider` | `EAnimatedCarouselSlider` |
| `WMarquee` | `EMarquee` |
| `WScroller` | `EScroller` |
| `WFocusEffect` | `EFocusEffect` |
| `WFocusable` | `EFocusable` |
| `WKeyGuide` / `WKeyGuideItem` / `WKeyGuideController` | `EKeyGuide` / `EKeyGuideItem` / `EKeyGuideController` † |
| `WFullScreenPopup` | `EWizardPanels` |
| `WLayeredPopup` | `EFlexiblePopupPanels` |
| `WActionGuide` | `EActionGuide` |
| `WColorTokens` / `WFontTokens` / `WSpaceTokens` | `EColorTokens` / `EFontTokens` / `ESpaceTokens` |
| `WTheme` | `ETheme` |
| `ButtonSize` | `EButtonSize` |

⚠ = Breaking change — see Parameter changes section below.
† = Deprecated target — see Deprecated migration targets section below.

All enum values follow the same prefix rule (e.g., `WAlertType.overlay` → `EAlertType.overlay`).

**Types without `E` prefix (exceptions)** — some utility types used with `FocusScrollConfig` keep the original name:

| Identifier | Note |
|---|---|
| `AlignFocusedElement` | Type for `FocusScrollConfig.alignFocusedElement`. Not `EAlignFocusedElement`. |

---

## Deprecated migration targets

Handling rules are in Step 2-2. If an alternative exists, replace directly; otherwise rename + TODO.

| Elemental UI | Deprecated since | Recommended alternative |
|---|---|---|
| `ETabs` | 2025-06-30 | Use `ETabLayout` + `ETabLayoutController` |
| `ETabController` | 2025-05-19 | Use `ETabLayoutController` |
| `EInput` | 2025-06-30 | Replace with `EInputField` + `EInputPopup` |
| `ERadioButton` | — | Use `ERadioItem` |
| `ESwitch` | — | Use `ESwitchItem` or `ESwitchBase` |
| `EToast` | — | Use `EAlert` (overlay mode) or `ETooltip` |
| `EToastContext` | — | Use `EAlert` (overlay mode) |
| `ECarousel` | 2025-06-30 | Use `EAnimatedCarousel` or `EAnimatedCarouselSlider` |
| `EProgressButton` | 2025-06-30 | Use `EButton` + `EProgressBar` |
| `EMediaItem` | 2025-06-30 | Use `EImageItem` or `EGridItem` |
| `EKeyGuide` | 2025-06-30 | Use `EQuickGuidePanels` for step-by-step guide flows |
| `EKeyGuideItem` | 2025-06-30 | Use `EQuickGuidePanels` with `EQuickGuidePanel` children |
| `EKeyGuideController` | 2025-06-30 | Use `EActionGuide` or `EQuickGuidePanels` |

**Deprecated parameters** (widget itself not deprecated):

| Widget | Deprecated param | Alternative |
|---|---|---|
| `EPopup` | `open` (since 2025-04-18) | Use `EPopupController` |
| `EAlert` | `open` (since 2025-04-18) | Use alert controller pattern |
| `EPanels` | `index` | Use `EPanelsController.index` |

---

## Parameter changes

### WButton → EButton ⚠

| Type | Before | After |
|---|---|---|
| Child widget | `child: Text('OK')` | `text: 'OK'` or `buildChildWidget: (ctx, s) => Text('OK')` |
| Animation toggle | `animation: true` | `enableAnimation: true` |
| Button size | `size: ButtonSize.small` | `size: EButtonSize.small` |
| Semantics | `semanticButtonLabel: 'x'` | `semanticsLabel: 'x'` |
| Removed | `keepChild`, `originScale`, `onKey` | remove param |

### WVirtualList → EVirtualList ⚠

| Type | Before | After |
|---|---|---|
| 3rd itemBuilder arg | `isFocused: bool` | `focusNode: EFocusNode` |
| New optional param | — | `itemSize: double?` (auto-estimated when null) |
| New optional param | — | `hoverScrollSpeed`, `padding`, `onFocusChangeItem`, `alignFocusedElement` |
| Focus rule | — | `focusNode` MUST be forwarded to the child |

### WSpinner → ESpinner

Param names unchanged — only enum prefixes change:

| Type | Before | After |
|---|---|---|
| Block type | `blockClickOn: WSpinnerBlock.screen` | `blockClickOn: ESpinnerBlock.screen` |
| Size type | `size: WSpinnerSize.large` | `size: ESpinnerSize.large` |
| Size default | `WSpinnerSize.small` | `ESpinnerSize.large` |
| transparent default | `false` | `true` |

### WSwitchItem → ESwitchItem ⚠

| Type | Before | After |
|---|---|---|
| Removed | `centered`, `inline`, `slotAfter`, `slotBefore` | remove param |
| children | `children: ['Label']` | unsupported — wrap with `EItem` |
| New | — | `focused` |

### WTooltip → ETooltip

Param names unchanged — only enum prefixes change (W→E). New `ETooltipPosition` values: `aboveCenter`, `aboveLeft`, `aboveRight`, `belowCenter`, `belowLeft`, `belowRight`, `leftBottom`, `leftMiddle`, `leftTop`, `rightBottom`, `rightMiddle`, `rightTop`.

### WTabs → ETabs

```dart
// before
WTabs(wTabController: myController, ...)
// after
ETabs(eTabController: myController, ...)
```

---

## Manual-review items (TODO tags)

Add `// TODO(migrate): <reason>` for patterns that cannot be auto-converted:

1. `WButton(child: complexWidget)` — convert to `buildChildWidget:`
2. `WVirtualList` itemBuilder — change 3rd arg from `isFocused: bool` to `focusNode: EFocusNode`; forward focusNode to child
3. `WSwitchItem(children: ...)` — rewrite as `EItem` + `ESwitchItem`
4. `WPopup` — broad API surface; verify each param manually
5. `FiveWaysNavigationTraversalPolicy` — verify new class name in source
6. `WInput` — replace with `EInputField` + `EInputPopup`
7. `WKeyGuide` / `WKeyGuideItem` — replace with `EQuickGuidePanels` + `EQuickGuidePanel`
8. `WFullScreenPopup` — replace with `EWizardPanels`; no separate controller (use callbacks)
9. `WLayeredPopup` — replace with `EFlexiblePopupPanels`; `WLayeredPopupController` → `FlexiblePopupPanelsController`
10. `EPopup(open: ...)` — replace `open` with `EPopupController`
11. `EAlert(open: ...)` — replace `open` with controller pattern
12. `EPanels(index: ...)` — replace `index` with `EPanelsController.index`

---

## Source paths

- Plover source: `/home/younginkim/project/Elemental_UI/flutter_app_components/lib/`
- Elemental UI source: `/home/younginkim/project/Elemental_UI/elemental_widgets/lib/elutter/`
- Plover package: `plover` (v0.7.86)
- Elemental UI package: `elutter` (v1.0.0)
