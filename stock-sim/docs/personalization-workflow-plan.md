# Personalization and Workflow System

## Comprehensive implementation plan

**Project:** Stock Sim / MarketVerse
**Status:** Planned
**Owner:** Product and platform engineering
**Last updated:** 2026-08-10

## 1. Executive summary

This plan turns the application into a personalized research workspace. Users will be able to arrange panels, save layouts, customize market screens, annotate research, navigate by keyboard, and move between desktop, multi-monitor, and mobile read-only experiences without losing context.

The central design decision is to build one reusable Workspace System instead of implementing independent customization logic in Market, Trading, Portfolio, and Future Lab. The Workspace System will own layout state, module registration, user preferences, navigation context, keyboard commands, and responsive behavior. Individual pages will provide modules to the system.

The implementation should be delivered incrementally:

1. Workspace foundation and persistence.
2. Resizable, draggable, saved layouts.
3. Research preferences, watchlists, screeners, and navigation.
4. Notes, tags, folders, pins, and bookmarks.
5. Accessibility, responsive read-only mode, and multi-monitor support.
6. Advanced workflow polish, migration, analytics, and rollout.

The first usable release should let a user create a custom Market/Trading desk, save it, reopen it, change density/theme, and navigate the whole workspace from the keyboard.

## 2. Goals

### Primary goals

- Let users arrange research and trading tools around their own workflow.
- Preserve layouts, filters, watchlists, notes, and navigation state across sessions and devices.
- Make the existing Market, Trading, Portfolio, and Future Lab surfaces composable.
- Support both dense terminal-style research and comfortable exploratory analysis.
- Make keyboard and screen-reader navigation first-class.
- Provide a safe, read-only mobile experience without pretending mobile is a full trading desk.
- Create foundations reusable by future multiplayer, instructor, and community workspaces.

### Secondary goals

- Reduce repeated setup time for recurring workflows.
- Make research context visible and cross-linked across pages.
- Support user-created presets such as Trading Desk, Research Desk, Portfolio Review, and Classroom View.
- Provide measurable adoption and workflow-efficiency signals.

### Non-goals for the first release

- Replacing the existing trading engine.
- Building a general-purpose low-code dashboard builder.
- Allowing arbitrary user JavaScript or untrusted embedded widgets.
- Full mobile trade execution.
- Native multi-window desktop applications.
- Collaborative real-time editing of the same workspace by multiple users.

## 3. Current foundation to reuse

The codebase already contains several useful primitives:

- Market Explorer with saved screens, custom columns, density controls, keyboard interactions, and command-line filtering.
- Trading and simulation surfaces with reusable chart, portfolio, and timeline components.
- Global command/navigation patterns.
- Authenticated user accounts and user-scoped data.
- Timeline branching and deterministic replay infrastructure.
- Chart drawing tools, indicators, comparison views, and event markers.
- React Query API hooks and a shared API client.
- Meridian design tokens plus terminal-specific styling tokens.

The new system should wrap and extend these primitives rather than create a second navigation, chart, or preference system.

## 4. Product concept

### 4.1 Workspace

A workspace is a named, user-owned arrangement of modules and preferences.

Examples:

- **Trading Desk:** watchlist, chart, order ticket, order book, positions, news.
- **Research Desk:** screener, chart, fundamentals, valuation, news, notes.
- **Portfolio Review:** performance, risk, allocation, transactions, goals.
- **Future Lab:** timeline controls, scenario inputs, comparison chart, replay ledger.
- **Classroom View:** assigned scenario, portfolio, cohort ranking, instructor notes.

A workspace contains layout, module configuration, theme, density, shortcut profile, and navigation context.

### 4.2 Module

A module is a registered application surface that can be placed in a workspace.

Each module must declare:

- Stable module ID.
- Display name and description.
- Icon and category.
- Minimum and maximum size.
- Supported contexts, such as ticker, portfolio, timeline, or league.
- Default configuration.
- Required permissions.
- Mobile behavior.
- Keyboard entry points.
- Data dependencies.

Initial module registry:

- Market screener.
- Watchlist.
- Price chart.
- Chart comparison.
- Order ticket.
- Order book.
- Positions.
- Portfolio performance.
- Portfolio risk.
- Fundamentals.
- Valuation.
- News.
- Economic calendar.
- Event timeline.
- Notes.
- Bookmarks.
- Session controls.
- Replay controls.
- Leaderboard.

### 4.3 Context

Workspace context determines what a module is showing. It may include:

```json
{
  "timelineId": 12,
  "ticker": "NVDA",
  "portfolioId": 4,
  "watchlistId": 2,
  "simDate": "2026-08-10",
  "comparisonTickers": ["NVDA", "AMD"]
}
```

Context must be URL-addressable where possible so links, bookmarks, notes, and browser history can reopen the same research state.

## 5. Feature coverage map

| Requested feature | Delivery area | Release target |
|---|---|---|
| Resizable multi-panel workspaces | Workspace shell and layout engine | MVP |
| Multiple saved layouts | Workspace persistence and layout switcher | MVP |
| Drag-and-drop dashboard modules | Module registry and drag/drop canvas | MVP |
| Compact and comfortable density | Global preference provider | MVP |
| Dark and light research themes | Theme token system | MVP |
| Multi-monitor layouts | Window/layout slots and detachable views | Phase 4 |
| Full keyboard navigation | Focus manager and command registry | MVP |
| Global command palette | Command bus and search providers | MVP |
| Custom watchlist columns | Watchlist configuration model | MVP / existing extension |
| Saved filters and screeners | Screen persistence and sharing scope | MVP / existing extension |
| Pin any chart or metric anywhere | Pin model and pinned module | Phase 2 |
| Focus mode for one company or portfolio | Context manager and focus route | MVP |
| Split-screen chart comparison | Comparison module and linked context | Phase 2 |
| Custom shortcuts | User shortcut profiles | Phase 2 |
| Cross-linked symbol navigation | Symbol resolver and context bus | MVP |
| Session bookmarks | Bookmark model and replay context | Phase 2 |
| Personal research notes | Notes editor and context links | Phase 2 |
| Tagging and folders | Taxonomy and search | Phase 2 |
| Responsive read-only mobile view | Responsive module policy | MVP |
| Accessibility controls | Preference panel and semantic QA | MVP / ongoing |

## 6. Technical architecture

### 6.1 Frontend layers

```text
App shell
  ├── UserPreferenceProvider
  ├── WorkspaceProvider
  ├── ContextProvider
  ├── CommandRegistryProvider
  ├── FocusManager
  └── Notification/Toast provider

WorkspaceShell
  ├── WorkspaceHeader
  ├── LayoutSwitcher
  ├── WorkspaceCanvas
  │   ├── ModuleFrame
  │   ├── ModuleToolbar
  │   └── RegisteredModule
  ├── WorkspaceInspector
  └── MobileReadOnlyShell
```

### 6.2 Backend layers

```text
Workspace API
  ├── Workspace CRUD
  ├── Layout versioning
  ├── Module configuration
  ├── User preferences
  ├── Notes/tags/folders/bookmarks
  ├── Watchlists/screeners
  ├── Shortcut profiles
  └── Activity/audit events

Application services
  ├── WorkspaceService
  ├── LayoutService
  ├── PreferenceService
  ├── ResearchArtifactService
  ├── SymbolContextService
  └── ShortcutService
```

### 6.3 Persistence principles

- All user-owned records must have explicit ownership or access scope.
- Layout mutations must be versioned so accidental changes can be undone.
- References to tickers, portfolios, timelines, and charts must remain valid after entity renames where possible.
- User preferences must be schema-versioned for safe client migration.
- Workspace data must be portable as JSON for backup/export.
- Soft deletion should be used for notes, layouts, and folders to support recovery.

## 7. Data model

Names below are logical models. Exact SQLAlchemy names and migration details should follow project conventions.

### 7.1 Workspaces

```text
workspaces
- id
- owner_user_id
- name
- description
- workspace_type
- active_layout_id
- is_default
- is_archived
- created_at
- updated_at

workspace_layouts
- id
- workspace_id
- name
- version
- layout_json
- breakpoint_rules_json
- monitor_slots_json
- is_default
- created_at
- updated_at

workspace_modules
- id
- workspace_layout_id
- module_key
- instance_key
- title_override
- position_json
- size_json
- config_json
- context_json
- is_visible
- mobile_policy
- created_at
- updated_at
```

### 7.2 User preferences

```text
user_preferences
- user_id
- theme: dark | light | system
- density: compact | comfortable
- font_scale
- contrast_mode
- reduced_motion
- keyboard_navigation_enabled
- mobile_read_only_mode
- default_workspace_id
- active_shortcut_profile_id
- preference_schema_version
- updated_at

shortcut_profiles
- id
- owner_user_id
- name
- bindings_json
- is_default
- created_at
- updated_at
```

### 7.3 Research artifacts

```text
research_notes
- id
- owner_user_id
- title
- body
- note_type
- status
- context_json
- folder_id
- created_at
- updated_at

research_note_links
- note_id
- entity_type
- entity_id
- context_json

research_tags
- id
- owner_user_id
- name
- color

research_tag_links
- tag_id
- entity_type
- entity_id

research_folders
- id
- owner_user_id
- parent_folder_id
- name
- position
- created_at
- updated_at

research_bookmarks
- id
- owner_user_id
- name
- bookmark_type
- route
- context_json
- sim_date
- timeline_id
- ticker
- folder_id
- created_at
- updated_at

pinned_metrics
- id
- owner_user_id
- workspace_id
- module_instance_key
- metric_key
- entity_type
- entity_id
- display_config_json
- created_at
- updated_at
```

### 7.4 Watchlists and screeners

Extend existing watchlist/screen models rather than duplicate them:

```text
watchlists
- add owner_user_id
- add description
- add folder_id
- add display_config_json
- add position
- add is_archived

saved_screens
- add owner_user_id
- add folder_id
- add visibility: private | shared
- add display_config_json
- add shortcut

watchlist_columns
- watchlist_id
- column_key
- position
- is_visible
- width
- sort_direction
- sort_priority
```

### 7.5 Layout change history

```text
workspace_change_log
- id
- workspace_id
- user_id
- action
- before_json
- after_json
- created_at
```

This supports undo, audit history, debugging, and future collaborative workflows.

## 8. Workspace layout engine

### 8.1 Layout strategy

Use a constrained grid layout rather than arbitrary absolute positioning.

Each module has:

- `x`, `y`, `w`, `h` grid coordinates.
- `minW`, `minH`, `maxW`, `maxH` constraints.
- `isResizable` and `isDraggable` flags.
- Breakpoint-specific overrides.
- A stable `instanceKey` so configuration survives movement.

The grid should prevent overlap, preserve readable minimum sizes, and gracefully compact when modules are removed.

### 8.2 Module frames

Every module frame should provide:

- Title and module identity.
- Context indicator, such as ticker or portfolio.
- Minimize, maximize, move, resize, pin, and close controls where allowed.
- Loading, error, empty, and stale-data states.
- Keyboard focus ring.
- Accessible label and landmark role.
- Optional module-specific command menu.

### 8.3 Layout operations

Required operations:

- Add module.
- Remove module.
- Move module.
- Resize module.
- Duplicate layout.
- Rename layout.
- Reset layout.
- Undo last layout change.
- Revert to saved version.
- Import/export layout JSON.
- Set default layout.
- Copy layout to another workspace.

### 8.4 Persistence behavior

Use optimistic local state for drag and resize operations, then debounce persistence. Persist only after the user pauses movement for a short interval or releases the resize handle.

Rules:

- Do not send one API request per pixel moved.
- If persistence fails, keep local changes visible and show a recoverable warning.
- Include layout version in writes to detect conflicts.
- On conflict, preserve the local layout and offer “keep mine,” “use server,” or “duplicate as new layout.”

## 9. Density system

### Compact mode

- Smaller row heights.
- Reduced panel padding.
- Tighter chart toolbars.
- More table columns visible.
- Minimal descriptive copy.
- Optimized for active research and trading.

### Comfortable mode

- Larger hit targets.
- More whitespace.
- Larger type and row spacing.
- More explanatory labels.
- Better default for portfolio review and learning.

Density must be token-driven. Components may not hard-code independent density values.

Required tokens:

- `--workspace-space-*`
- `--workspace-panel-padding`
- `--workspace-row-height`
- `--workspace-control-height`
- `--workspace-font-scale`
- `--workspace-chart-toolbar-gap`

## 10. Theme system

### Dark theme

The existing terminal and Meridian dark tokens become the default dark research theme.

### Light theme

Create a full semantic light token set rather than applying a CSS inversion filter.

Required semantic tokens:

- Canvas and panel surfaces.
- Primary, secondary, and muted text.
- Hairline and emphasis borders.
- Accent and focus states.
- Positive, negative, warning, and neutral market states.
- Chart grid, crosshair, candle, volume, and annotation colors.

Theme requirements:

- No component may depend directly on a dark-only hex value.
- Charts must receive theme colors through a theme adapter.
- User theme preference must load before hydration where possible to avoid flashing.
- Theme changes must not reset layout or module state.

## 11. Multi-monitor layout strategy

Multi-monitor support should be implemented as named monitor slots, not as a dependency on a native desktop API.

### Initial browser-based model

- Monitor 1: primary workspace.
- Monitor 2: secondary workspace route opened in a new window.
- Each window identifies itself with a `windowSlot` query parameter.
- Both windows load the same workspace and different layout slots.
- Changes sync through server persistence and `BroadcastChannel` locally.

### Later enhancement

- Window placement preferences where supported.
- Pop-out module windows.
- Read-only spectator window.
- Reconnect behavior if one monitor window closes.

Graceful fallback: if pop-out or multi-window behavior is unavailable, show separate browser tabs with the same layout-slot semantics.

## 12. Keyboard navigation and command system

### Focus model

Implement a central focus manager with:

- Workspace-level focus order.
- Module-level focus order.
- Roving focus for dense tables and toolbars.
- Escape behavior that closes the deepest active overlay first.
- Focus restoration after dialogs, command palette, and module removal.
- Visible focus indicators in both themes.

### Command registry

Commands are registered by modules and can be invoked from:

- Global command palette.
- Keyboard shortcut.
- Context menu.
- Deep link.
- Screen reader command descriptions.

Command shape:

```ts
type WorkspaceCommand = {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  shortcut?: string;
  available: (context: WorkspaceContext) => boolean;
  execute: (context: WorkspaceContext) => void | Promise<void>;
};
```

Initial commands:

- Open symbol.
- Open company focus mode.
- Open portfolio focus mode.
- Switch workspace.
- Switch layout.
- Add module.
- Save layout.
- Reset layout.
- Toggle density.
- Toggle theme.
- Toggle reduced motion.
- Save screener.
- Open watchlist.
- Add note.
- Add bookmark.
- Pin current metric.
- Compare selected symbols.
- Jump to simulation date.
- Open replay controls.

### Shortcut conflict rules

- Browser and operating-system shortcuts cannot be overridden by default.
- User shortcuts must be validated before saving.
- Conflicts must display both commands and offer reassignment.
- Every command must remain accessible through the palette even without a shortcut.

## 13. Global command palette

The palette should search across:

- Commands.
- Symbols.
- Companies.
- Portfolios.
- Watchlists.
- Saved screens.
- Workspaces and layouts.
- Notes and bookmarks.
- Recent sessions.

Search result groups should be ranked in this order:

1. Exact symbol or command match.
2. Recently used items.
3. Current-context items.
4. User-created artifacts.
5. Global search results.

The palette must support keyboard-only usage, fuzzy matching, recent history, and direct actions such as “note NVDA” or “compare AAPL MSFT.”

## 14. Watchlists, columns, filters, and screeners

### Watchlist columns

Users can:

- Add and remove columns.
- Reorder columns.
- Resize columns.
- Save sort order.
- Choose primary and secondary sort.
- Save different column profiles per watchlist.
- Reset to defaults.

Column definitions should be registry-based so the same definitions can be reused in Market Explorer, watchlists, and portfolio tables.

### Saved filters and screeners

Enhance the existing saved-screen behavior with:

- Named filters.
- Folder organization.
- Keyboard shortcuts.
- Private/shared visibility.
- Last-used timestamp.
- Duplicate and version actions.
- Export/import.
- Optional alerting when a company enters or leaves a screen.

### URL and persistence contract

Every saved screen should be reproducible from:

- Filter expression.
- Sort state.
- Column profile.
- Density.
- Historical date, if applicable.
- Timeline context, if applicable.

## 15. Focus mode and symbol context

### Company focus mode

Focus mode creates a dedicated context containing:

- Selected ticker.
- Current timeline and simulation date.
- Price history range.
- Active chart overlays.
- News and events.
- Notes and tags.
- Related watchlists.

Entering focus mode should not lose the previous workspace. Exiting restores the prior layout and selected context.

### Portfolio focus mode

Portfolio focus mode should provide:

- Portfolio value and risk.
- Holdings and allocation.
- Performance range.
- Drawdown and Sharpe metrics.
- Transactions.
- Goals.
- Notes and review bookmarks.

### Cross-linked symbol navigation

All symbol mentions should resolve through one symbol resolver. A symbol link should preserve:

- Current timeline.
- Current simulation date.
- Source workspace.
- Preferred destination module.

Examples:

- Market table symbol → company focus.
- News symbol → chart at event date.
- Portfolio holding → order ticket with symbol selected.
- Note symbol → note context and company focus.

## 16. Chart comparison and pins

### Split-screen chart comparison

Support:

- Two to four synchronized charts.
- Shared date range.
- Optional normalized performance mode.
- Shared crosshair.
- Independent indicators.
- Compare by ticker, sector, benchmark, or portfolio.
- Save comparison as a bookmark.

### Pin any chart or metric

A pin captures a metric or chart configuration, not a screenshot only.

Pin payload should include:

- Metric/chart type.
- Entity and timeline context.
- Date range.
- Formula or metric version.
- Display formatting.
- Source module.
- Last refreshed timestamp.

Pinned items can be:

- Added as a workspace module.
- Added to a notes page.
- Added to a portfolio review.
- Exported as an image or data file.

## 17. Notes, tags, folders, and bookmarks

### Notes

Notes should support:

- Plain text and Markdown.
- Autosave with draft recovery.
- Symbol, portfolio, timeline, and date links.
- Checklists for research workflows.
- Status: draft, active, archived.
- Created/updated history.
- Export.

### Tags

Tags should be user-owned and reusable across notes, watchlists, bookmarks, pinned metrics, and saved screens.

Examples:

- `high-conviction`
- `earnings-risk`
- `macro-sensitive`
- `follow-up`

### Folders

Folders should support nesting with a safe depth limit. Deleting a folder must offer:

- Move contents to parent.
- Move contents to another folder.
- Archive contents.

### Session bookmarks

A bookmark must reopen the relevant research state, including:

- Route.
- Workspace and layout.
- Ticker or portfolio.
- Timeline and date.
- Chart range and indicators.
- Open panels.
- Replay tick, if applicable.

## 18. Responsive read-only mobile view

Mobile is a focused research surface, not a compressed desktop grid.

### Mobile behavior

- Convert multi-panel layouts into a prioritized vertical feed.
- Preserve module order from the desktop layout.
- Allow users to choose the first three mobile modules.
- Hide drag-and-drop and complex resize controls.
- Keep symbol search, chart, watchlist, news, and portfolio summary available.
- Show trading controls only if explicitly enabled and safe.
- Default to read-only mode.

### Mobile module policies

Each module declares:

- `full`: render normally.
- `collapsed`: render header and summary.
- `hidden`: do not render on mobile.
- `readOnly`: remove mutations.
- `redirect`: link to a dedicated mobile route.

### Offline and poor connectivity

- Cache last successful watchlist and portfolio snapshot.
- Show freshness timestamp.
- Never imply live data when stale.
- Queue only non-destructive preference changes; do not queue trades by default.

## 19. Accessibility system

### Required controls

- Reduced motion.
- High-contrast mode.
- Font-size scaling.
- Larger controls.
- Keyboard-only mode.
- Color-safe market states.
- Screen-reader verbosity preference.

### Component requirements

- All drag/drop actions have keyboard alternatives.
- All charts have text summaries and tabular fallback data.
- All status changes have accessible announcements.
- All icon-only buttons have labels.
- Focus is never trapped unintentionally.
- Resizable panels expose keyboard resize instructions.
- Color is not the only indicator of market direction.
- Motion respects `prefers-reduced-motion` and user preference.

### Accessibility verification

- Automated axe checks on core workspaces.
- Keyboard-only test scripts.
- Screen-reader smoke tests for palette, layout switcher, watchlist, and chart fallback.
- Contrast tests for both themes and all market states.

## 20. API design

### Workspace endpoints

```text
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/{workspace_id}
PATCH  /api/v1/workspaces/{workspace_id}
DELETE /api/v1/workspaces/{workspace_id}

GET    /api/v1/workspaces/{workspace_id}/layouts
POST   /api/v1/workspaces/{workspace_id}/layouts
GET    /api/v1/workspaces/{workspace_id}/layouts/{layout_id}
PATCH  /api/v1/workspaces/{workspace_id}/layouts/{layout_id}
POST   /api/v1/workspaces/{workspace_id}/layouts/{layout_id}/duplicate
POST   /api/v1/workspaces/{workspace_id}/layouts/{layout_id}/restore
POST   /api/v1/workspaces/{workspace_id}/layouts/import
GET    /api/v1/workspaces/{workspace_id}/layouts/{layout_id}/export
```

### Preferences and shortcuts

```text
GET    /api/v1/me/preferences
PATCH  /api/v1/me/preferences

GET    /api/v1/me/shortcut-profiles
POST   /api/v1/me/shortcut-profiles
PATCH  /api/v1/me/shortcut-profiles/{profile_id}
DELETE /api/v1/me/shortcut-profiles/{profile_id}
```

### Research artifacts

```text
GET    /api/v1/research/notes
POST   /api/v1/research/notes
GET    /api/v1/research/notes/{note_id}
PATCH  /api/v1/research/notes/{note_id}
DELETE /api/v1/research/notes/{note_id}

GET    /api/v1/research/bookmarks
POST   /api/v1/research/bookmarks
PATCH  /api/v1/research/bookmarks/{bookmark_id}
DELETE /api/v1/research/bookmarks/{bookmark_id}

GET    /api/v1/research/tags
POST   /api/v1/research/tags
PATCH  /api/v1/research/tags/{tag_id}
DELETE /api/v1/research/tags/{tag_id}

GET    /api/v1/research/folders
POST   /api/v1/research/folders
PATCH  /api/v1/research/folders/{folder_id}
DELETE /api/v1/research/folders/{folder_id}
```

### Watchlist and screen configuration

```text
GET    /api/v1/watchlists/{watchlist_id}/columns
PUT    /api/v1/watchlists/{watchlist_id}/columns

GET    /api/v1/screens/{screen_id}/configuration
PUT    /api/v1/screens/{screen_id}/configuration
POST   /api/v1/screens/{screen_id}/duplicate
```

### API requirements

- Every mutation requires authentication and ownership/access checks.
- Use optimistic concurrency through `version` or `updated_at` checks.
- Validate module keys against the server-side registry.
- Limit JSON payload sizes.
- Rate-limit autosave and layout writes.
- Return normalized errors for conflict, permission, validation, and stale-version cases.

## 21. Frontend implementation plan

### New shared modules

```text
apps/web/components/workspace/
  WorkspaceShell.tsx
  WorkspaceCanvas.tsx
  WorkspaceHeader.tsx
  LayoutSwitcher.tsx
  LayoutInspector.tsx
  ModuleFrame.tsx
  ModulePicker.tsx
  WorkspaceContextBar.tsx
  MobileWorkspaceView.tsx
  WorkspaceEmptyState.tsx
  WorkspaceConflictDialog.tsx

apps/web/lib/workspace/
  moduleRegistry.ts
  layoutEngine.ts
  workspaceContext.ts
  workspaceStorage.ts
  focusManager.ts
  commandRegistry.ts
  shortcutResolver.ts
  themePreferences.ts
  densityPreferences.ts
```

### New hooks

```text
useWorkspaces()
useWorkspace(workspaceId)
useWorkspaceLayouts(workspaceId)
useWorkspaceLayout(workspaceId, layoutId)
useCreateWorkspace()
useSaveWorkspaceLayout()
useWorkspacePreferences()
useResearchNotes()
useResearchBookmarks()
useResearchTags()
useResearchFolders()
useShortcutProfiles()
```

### Integration targets

- Refactor Market Explorer into a registered module without changing its core filtering behavior.
- Extract existing command palette commands into the global command registry.
- Move existing density and saved-screen state into shared preference/configuration contracts.
- Reuse the existing chart components as configurable modules.
- Expose current timeline and ticker state through the shared context provider.
- Add workspace entry points to Market, Trading, Portfolio, and Future Lab routes.

## 22. Delivery phases

### Phase 0 — Discovery and contracts

Deliverables:

- Module registry specification.
- Layout JSON schema.
- Workspace context schema.
- Preference schema.
- API contracts and ownership rules.
- Accessibility and responsive acceptance checklist.
- Migration strategy for existing saved screens and density preferences.

Exit criteria:

- Schemas reviewed.
- Existing Market and Simulation surfaces mapped to modules.
- No duplicate preference sources identified.

### Phase 1 — Workspace MVP

Deliverables:

- Workspace and layout database models.
- CRUD APIs.
- Workspace shell.
- Module registry.
- Add/remove modules.
- Drag-and-drop movement.
- Panel resizing.
- Save, duplicate, rename, reset layouts.
- Layout switcher.
- Initial Market and Trading modules.

Exit criteria:

- A user can create a workspace, arrange at least six modules, save it, reload it, and recover after refresh.
- Layout writes are debounced and conflict-safe.
- Keyboard alternatives exist for all layout actions.

### Phase 2 — Preferences and workflow controls

Deliverables:

- Compact and comfortable density.
- Dark and light themes.
- Focus mode.
- Mobile read-only layout.
- Global command palette.
- Full keyboard navigation.
- Cross-linked symbol navigation.
- Custom shortcuts.

Exit criteria:

- User preference changes persist across sessions.
- Theme changes do not cause hydration flicker or layout loss.
- All core commands are palette-accessible.
- Keyboard-only user can complete a research workflow.

### Phase 3 — Research organization

Deliverables:

- Notes.
- Tags.
- Folders.
- Bookmarks.
- Chart and metric pins.
- Saved watchlist column profiles.
- Saved screener folders and shortcuts.

Exit criteria:

- A user can save a note from a chart, attach ticker/date/timeline context, find it later, and reopen the original state.
- Pinned metrics can be placed into any supported workspace.
- Folders and tags work consistently across artifacts.

### Phase 4 — Comparison and multi-monitor workflows

Deliverables:

- Split-screen chart comparison.
- Linked crosshair and time range.
- Monitor slots.
- New-window layout routes.
- BroadcastChannel synchronization.
- Pop-out read-only module support where available.

Exit criteria:

- Two browser windows can display different layout slots for one workspace.
- Context changes are correctly reflected without overwriting unrelated layouts.
- Comparison state survives bookmark and reload.

### Phase 5 — Accessibility hardening and mobile release

Deliverables:

- Font-size controls.
- High-contrast mode.
- Reduced-motion setting.
- Screen-reader chart summaries.
- Mobile module prioritization.
- Stale-data and read-only indicators.
- Accessibility regression suite.

Exit criteria:

- Core flows pass automated and manual accessibility checks.
- Mobile view works on narrow and wide phone widths.
- No mutation is exposed accidentally in read-only mode.

### Phase 6 — Adoption, analytics, and polish

Deliverables:

- Onboarding presets.
- Recent layouts.
- Workspace usage analytics.
- Import/export.
- Recovery from corrupted layout JSON.
- Performance profiling.
- Documentation and help content.

Exit criteria:

- Users can recover from invalid layouts.
- Workspace load time meets the performance budget.
- Product analytics show which modules and presets are used.

## 23. Migration plan

### Existing users

- Preserve the current Market Explorer experience as the default legacy workspace.
- Import current saved screens into the new screener configuration format.
- Import density preference into user preferences.
- Preserve current keyboard shortcuts unless a conflict exists.
- Do not force users into a new layout on first login.

### New users

Offer preset selection during onboarding:

- Market Explorer.
- Trading Desk.
- Research Desk.
- Portfolio Review.
- Empty Workspace.

### Data migration safety

- Run migrations without deleting old saved-screen data.
- Add `migration_status` and `migration_error` fields where needed.
- Make imports idempotent.
- Keep a rollback path for layout conversion.
- Log conversion failures without blocking login.

## 24. Performance requirements

### Load performance

- Initial workspace shell should render before non-critical modules finish loading.
- Independent modules should fetch in parallel.
- Heavy charts and comparison modules should use dynamic imports.
- Do not hydrate hidden mobile modules.
- Use stale-while-revalidate for read-heavy modules.

### Interaction performance

- Drag and resize must remain responsive with at least 20 visible modules.
- Persist layout changes after release/debounce, not every pointer movement.
- Avoid re-rendering unrelated modules when one module changes context.
- Use stable module instance keys and memoized module props.

### Data budgets

- Workspace layout payload: target under 100 KB.
- User preference payload: target under 20 KB.
- Initial visible modules: target no more than 8 concurrent requests.
- Notes list: paginate and virtualize after 100 items.

## 25. Security and privacy

- Enforce user ownership on every workspace, layout, note, bookmark, tag, and shortcut API.
- Prevent users from loading another user's entity IDs through layout JSON.
- Validate all module configurations server-side.
- Strip unsupported or dangerous fields from imported JSON.
- Treat notes and tags as private by default.
- Record access scope if sharing is added later.
- Avoid putting sensitive portfolio information in public URLs by default.
- Apply rate limits to autosave, search, and import endpoints.
- Audit destructive actions such as deleting a workspace or folder.

## 26. Testing strategy

### Unit tests

- Layout collision and compaction.
- Resize constraints.
- Breakpoint conversion.
- Layout serialization/deserialization.
- Preference migration.
- Shortcut conflict detection.
- Command availability.
- Context merge and restoration.
- Tag and folder hierarchy rules.
- Bookmark context validation.

### API tests

- Workspace CRUD and ownership.
- Layout version conflicts.
- Import/export validation.
- Preference persistence.
- Note/bookmark/tag/folder permissions.
- Watchlist column configuration.
- Rate-limit behavior.
- Soft-delete recovery.

### Component tests

- Add/remove/reorder modules.
- Drag and resize with keyboard alternatives.
- Layout switching.
- Theme and density changes.
- Command palette search and execution.
- Focus restoration after overlays.
- Symbol cross-linking.
- Mobile read-only behavior.
- Chart pin and bookmark creation.

### End-to-end tests

1. Create a Trading Desk workspace.
2. Add watchlist, chart, order book, and portfolio modules.
3. Resize and reorder modules.
4. Save and reload the layout.
5. Switch to light theme and comfortable density.
6. Open a symbol through the command palette.
7. Add a note and bookmark the session.
8. Reopen the bookmark and verify context.
9. Open the mobile read-only route.
10. Open a second monitor slot and verify synchronization.

### Accessibility tests

- Keyboard-only complete workflow.
- Screen reader module navigation.
- High-contrast screenshot review.
- Reduced-motion behavior.
- Zoom and font-size checks.
- Touch target review on mobile.

## 27. Observability

Track:

- Workspace creation and activation.
- Layout save success/failure/conflict.
- Module add/remove frequency.
- Most-used modules.
- Theme and density usage.
- Command palette searches and failed commands.
- Shortcut conflicts.
- Bookmark reopen rate.
- Mobile read-only usage.
- Workspace load and module error rates.

Do not log note bodies, private research text, or sensitive portfolio values.

## 28. Product analytics and success metrics

### Activation metrics

- Percentage of active users creating or editing a workspace.
- Time from first login to first saved layout.
- Percentage of users who reopen a saved layout.
- Percentage of users using at least three modules.

### Workflow metrics

- Median time to reopen a previous research context.
- Command palette success rate.
- Bookmark creation and revisit rate.
- Notes created per active researcher.
- Saved screener reuse rate.
- Focus-mode usage.

### Quality metrics

- Layout persistence failure rate.
- Conflict rate.
- Invalid layout recovery rate.
- Mobile stale-data incidents.
- Accessibility issue count.
- Workspace shell performance percentiles.

## 29. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Layout engine becomes too complex | High | Use constrained grid and registry-based modules |
| Every page develops its own state model | High | Centralize context and workspace providers |
| Autosave causes excessive API traffic | Medium | Debounce and batch writes |
| Layout conflict overwrites user work | High | Versioned writes, undo, duplicate-on-conflict |
| Light theme looks incomplete | Medium | Define semantic tokens before component migration |
| Keyboard shortcuts conflict | Medium | Central registry and validation UI |
| Mobile layout becomes unusable | High | Explicit mobile policies and read-only scope |
| User data leaks through imported layouts | High | Server-side ownership validation |
| Large dashboards load slowly | High | Module lazy loading and request budgets |
| Existing Market behavior regresses | High | Preserve legacy workspace and add migration tests |
| Multi-monitor browser support varies | Medium | Monitor-slot routes with graceful tab fallback |
| Notes and bookmarks become disconnected | Medium | Require context payload and resolver validation |

## 30. Acceptance criteria for final delivery

The feature is ready for general release when:

- Users can create, save, duplicate, rename, and switch between layouts.
- Users can drag, resize, hide, and restore modules.
- Market, Trading, Portfolio, and Future Lab each expose supported modules.
- Compact and comfortable density modes work consistently.
- Dark and light themes cover all core pages and charts.
- Keyboard-only users can navigate, search, rearrange, and open contexts.
- The command palette can execute all core workspace actions.
- Watchlists support configurable columns and saved filters.
- Any supported chart or metric can be pinned into a workspace.
- Company and portfolio focus modes preserve and restore context.
- Chart comparison supports synchronized ranges and bookmarks.
- Users can create notes, tags, folders, and session bookmarks.
- Bookmarks reopen the correct ticker, timeline, date, layout, and chart state.
- Mobile presents an explicit read-only, stale-aware experience.
- Accessibility controls work for motion, contrast, and font size.
- Workspace APIs enforce ownership and version conflicts.
- Existing users retain their current workflows during migration.
- All critical flows have unit, API, component, end-to-end, and accessibility coverage.
- Performance budgets and observability dashboards are in place.

## 31. Suggested first implementation slice

Build this vertical slice first:

1. `WorkspaceShell` and `WorkspaceCanvas`.
2. Workspace/layout database models and CRUD APIs.
3. Module registry with Market Explorer, chart, watchlist, and portfolio modules.
4. Drag/drop, resize, add/remove, save, and layout switcher.
5. Compact/comfortable density preference.
6. Dark/light theme provider.
7. Keyboard-accessible module actions.
8. One end-to-end test covering create → arrange → save → reload.

This slice proves the architecture before notes, multi-monitor, pinning, and advanced research workflow features are layered on top.
