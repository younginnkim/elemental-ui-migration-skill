---
name: migrate-from-plover
description: Migrate Flutter app code from Plover (package:plover) to Elemental UI (package:elutter). Replaces imports, widget names, enums, and parameters.
argument-hint: "[dart_file_or_directory]"
---

# /migrate-from-plover

Migrate Flutter Dart code from the Plover widget library (`package:plover`) to Elemental UI (`package:elutter`).

Handles import replacement, widget renaming (W→E prefix), enum renaming, and parameter changes including breaking changes.

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

**Input:** `$ARGUMENTS` — path to a Dart file or directory. If empty, uses the currently open file in the IDE. Falls back to `lib/` if no IDE file is open.

---

## Steps

Follow these steps in order. Complete each before moving to the next.

### Step 1 — Scan for Plover usage

Determine the target path:
1. If `$ARGUMENTS` is provided, use it.
2. Otherwise, use the currently open file in the IDE (available as `ide_opened_file` in context).
3. If neither is available, fall back to `lib/`.

**If the target is a single file**, call directly:
```
scanDartFile({ path: <file> })
```

**If the target is a directory**, pre-filter with Grep first to avoid scanning every dart file:
1. Use the Grep tool to search for `package:plover` in `*.dart` files under the directory — this returns only the files that actually import Plover
2. Call `scanDartFile({ path: <file> })` for each matched file individually
3. Merge the results across all files before proceeding to Step 2

This pre-filtering step is critical for large projects: scanning 300 dart files to find 20 that import Plover is wasteful; Grep + targeted scans is much faster.

If the MCP is not available, use Glob + Read on only the Grep-matched files (not all dart files).

### Step 2 — Apply migrations

For each file with Plover usage, apply changes in this order using the **minimum reads possible**.
`scanDartFile` already gave you line numbers — use them. Do NOT read the full file.

**2-1. Replace import** (read top only)
- Read only the first 10 lines of the file to locate the import
- Edit: `import 'package:plover/plover.dart'` → `import 'package:elutter/elutter.dart'`

**2-2. Rename widgets and enums** (no read needed)
- For each Plover identifier in the Step 1 results, use Edit with `replace_all: true`
- Example: `old_string: "WButton"`, `new_string: "EButton"`, `replace_all: true`
- Do NOT read the file first — Edit handles replacement without a full read
- Apply the [Widget Mapping](#widget-mapping) table

**2-3. Apply parameter changes for breaking-change widgets** (targeted window reads)
- Parameter diffs are in the [Parameter Changes](#parameter-changes) section of this skill — do NOT call `getWidgetMigration()`
- For each breaking-change occurrence, you already know its line number from Step 1
- Read only a small window: `offset: <lineNum - 5>`, `limit: 40` — enough to see the full widget call
- Edit only that section; do not read the full file

**2-4. Mark manual items** (targeted window reads)
- Same approach: use line numbers from Step 1 to read small windows
- Add `// TODO(migrate): <reason>` comment on the relevant line

### Step 3 — TV focus rule check

After migrating, verify these rules in each file:

| Rule | Severity | Check |
|---|---|---|
| `focus-passthrough` | **critical** | `EVirtualList.itemBuilder` passes `focusNode` to child widget |
| `no-nested-efocusable` | **critical** | No widget with internal focus wrapped in `EFocusable` |
| `delegate-focus-events` | warning | Observation-only `EFocusable` has `focusOnTap: false, tapByEnter: false` |
| `popup-focus-restore` | warning | Focus restored when popup closes |

### Step 4 — Report

Output a summary:
- Files modified
- Total identifiers replaced
- Breaking changes that required manual edits
- Remaining `// TODO(migrate):` items

---

## Widget Mapping

Simple W→E prefix rename. All identifiers below:

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
| `WSpinner` | `ESpinner` ⚠ |
| `WToast` / `WToastContext` | `EToast` / `EToastContext` |
| `WTooltip` | `ETooltip` |
| `WTabs` / `WTabController` | `ETabs` / `ETabController` |
| `WHeading` | `EHeading` |
| `WBodyText` | `EBodyText` |
| `WInput` | `EInput` |
| `WSlider` | `ESlider` |
| `WProgressBar` | `EProgressBar` |
| `WProgressButton` | `EProgressButton` |
| `WIconItem` | `EIconItem` |
| `WImageItem` | `EImageItem` |
| `WMediaItem` | `EMediaItem` |
| `WCarousel` | `ECarousel` |
| `WAnimatedCarouselSlider` | `EAnimatedCarouselSlider` |
| `WMarquee` | `EMarquee` |
| `WScroller` | `EScroller` |
| `WFocusEffect` | `EFocusEffect` |
| `WFocusable` | `EFocusable` |
| `WKeyGuide` | `EKeyGuide` |
| `WActionGuide` | `EActionGuide` |
| `WColorTokens` / `WFontTokens` / `WSpaceTokens` | `EColorTokens` / `EFontTokens` / `ESpaceTokens` |
| `WTheme` | `ETheme` |
| `ButtonSize` | `EButtonSize` |

⚠ = Breaking change — see Parameter Changes below.

All enum values follow the same prefix change (e.g. `WAlertType.overlay` → `EAlertType.overlay`).

---

## Parameter Changes

### WButton → EButton ⚠

| Change | Before | After |
|---|---|---|
| Child widget | `child: Text('OK')` | `text: 'OK'` or `buildChildWidget: (ctx, s) => Text('OK')` |
| Animation toggle | `animation: true` | `enableAnimation: true` |
| Button size | `size: ButtonSize.small` | `size: EButtonSize.small` |
| Semantics | `semanticButtonLabel: 'x'` | `semanticsLabel: 'x'` |
| Removed | `keepChild`, `originScale`, `onKey` | delete these params |

### WVirtualList → EVirtualList ⚠

| Change | Before | After |
|---|---|---|
| itemBuilder | `(context, index)` | `(context, index, focusNode)` |
| New required | — | `itemHeight: 120` (double, px) |
| Removed | `hoverToScroll`, `noScrollByWheel`, `onScroll`, `onScrollStart`, `onScrollStop` | delete |
| Focus rule | — | pass `focusNode` to child widget |

### WSpinner → ESpinner ⚠

| Change | Before | After |
|---|---|---|
| Block param | `blockClickOn: WSpinnerBlock.screen` | `block: ESpinnerBlock.screen` |
| Message | `content: Text('Loading')` | `message: Text('Loading')` |
| Removed | `centered`, `container`, `scrim`, `transparent`, `paused` | delete |
| New | — | `showCurve`, `showDuration`, `disabled` |

### WSwitchItem → ESwitchItem ⚠

| Change | Before | After |
|---|---|---|
| Removed | `centered`, `inline`, `slotAfter`, `slotBefore` | delete |
| Children | `children: ['Label']` | not supported — use `EItem` wrapper |
| New | — | `focused` |

### WTooltip → ETooltip

| Change | Before | After |
|---|---|---|
| Position | `tooltipPosition: WTooltipPosition.above` | `direction: ETooltipDirection.above` |
| Delay | `tooltipDelay: 500` (int ms) | `showDelay: Duration(milliseconds: 500)` |
| Removed | `tooltipMarquee`, `tooltipWidth` | delete |

### WTabs → ETabs

```dart
// Before
WTabs(wTabController: myController, ...)
// After
ETabs(eTabController: myController, ...)
```

---

## Manual Review Items (TODO tags)

Add `// TODO(migrate): <reason>` for these patterns — they cannot be auto-converted:

1. `WButton(child: complexWidget)` — convert to `buildChildWidget:`
2. `WVirtualList` itemBuilder — add third `focusNode` argument
3. `WSpinner(container: ...)` — `ESpinner` has no container param; use `Stack`/`Overlay`
4. `WSwitchItem(children: ...)` — restructure as `EItem` + `ESwitchItem`
5. `WPopup` — large API; verify each param manually
6. `FiveWaysNavigationTraversalPolicy` — verify new class name in source

---

## Source Paths

- Plover source: `/home/younginkim/project/Elemental_UI/flutter_app_components/lib/`
- Elemental UI source: `/home/younginkim/project/Elemental_UI/elemental_widgets/lib/elutter/`
- Plover package: `plover` (v0.7.86)
- Elemental UI package: `elutter` (v1.0.0)
