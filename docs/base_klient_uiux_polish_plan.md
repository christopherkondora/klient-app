---
plan_id: base-klient-uiux-polish-2026-04-20
version: 1
status: ready
scope: base_klient_only
owner: agent
created_at: 2026-04-20
updated_at: 2026-04-21
source_inputs:
  - current_codebase
  - screenshot_dashboard_shell
  - screenshot_dashboard_main
  - screenshot_finances_top
  - screenshot_finances_lower
  - screenshot_clients_grid
  - screenshot_projects_list
  - screenshot_calendar_month
  - screenshot_files_root
  - screenshot_notes_panel
  - screenshot_settings_account
out_of_scope:
  - new_business_features
  - tax_logic_expansion
  - ads_module_polish_except_visual_side_effects_on_base_shell
  - database_schema_changes
  - billing_provider_behavior_changes
success_definition:
  - base_klient_feels_more_focused_than_feature_dense
  - key_routes_share_a_consistent_header_filter_card_pattern
  - trust_critical_screens_are_clearer_without_adding_complexity
  - each_polish_batch_can_be_completed_and_validated_by_a_single_agent
tracking:
  statuses: [todo, in_progress, blocked, done]
  required_update_fields: [status, owner, started_at, completed_at, evidence, validation]
  execution_unit: one_primary_screen_plus_optional_shared_system_task
---

# Base Klient UI/UX Polish Plan

## 1. Objective

This plan defines a release-polish workflow for the base Klient app.

Primary goal:
- make the product cleaner, more reliable, and more focused without adding major new functionality

Secondary goal:
- give an agent a deterministic sequence of tasks with clear dependencies, validation rules, and progress tracking

Core principle:
- prefer clarity, hierarchy, and consistency over adding new widgets, controls, or visual complexity

## 2. Product Interpretation

The base Klient app is strongest when understood as a desktop business operating system for Hungarian freelancers and small service businesses.

Functional layers:

```yaml
functional_layers:
  primary_core:
    - clients
    - projects
    - finances
    - calendar
  operational_support:
    - notes
    - files
    - contracts
    - expenses
    - recordings_and_transcription
    - team
  configuration_and_system:
    - settings
    - billing_configuration
    - tax_profile
    - subscription
```

Implication for polish work:
- the UI should visually prioritize the primary core
- support features should feel integrated, not equally loud
- trust-critical surfaces must be simpler than utility surfaces

## 3. Screenshot-Derived Findings

The findings below are based on the attached UI screenshots and cross-checked against the current code structure.

### 3.1 Screenshot Inventory

```yaml
screenshot_inventory:
  - id: UI-IMG-01
    screen: dashboard
    code_surface: src/pages/Dashboard.tsx
  - id: UI-IMG-02
    screen: finances_top
    code_surface: src/pages/Finances.tsx
  - id: UI-IMG-03
    screen: finances_lower
    code_surface: src/pages/Finances.tsx
  - id: UI-IMG-04
    screen: clients
    code_surface: src/pages/Clients.tsx
  - id: UI-IMG-05
    screen: projects
    code_surface: src/pages/Projects.tsx
  - id: UI-IMG-06
    screen: calendar
    code_surface: src/pages/Calendar.tsx
  - id: UI-IMG-07
    screen: files
    code_surface: src/pages/Files.tsx
  - id: UI-IMG-08
    screen: notes_panel
    code_surface: src/components/NotesPanel.tsx
  - id: UI-IMG-09
    screen: settings_account
    code_surface: src/pages/Settings.tsx
  - id: UI-IMG-10
    screen: shell_layout
    code_surface:
      - src/components/Layout.tsx
      - src/components/Sidebar.tsx
      - src/components/TitleBar.tsx
      - src/components/PomodoroTimer.tsx
```

### 3.2 Cross-Screen Strengths

```yaml
observed_strengths:
  - dark visual system is already coherent and premium-feeling
  - cards, tables, and panels share a recognizable visual language
  - client and project colors create strong visual anchors
  - finances feels product-grade, not prototype-like
  - notes panel already has a distinct personality and strong usability potential
  - files page is visually clean and calm
  - global shell feels like a desktop app, not a wrapped web app
```

### 3.3 Cross-Screen Weaknesses

```yaml
observed_weaknesses:
  - secondary text contrast is often too low for dense business screens
  - several screens have excellent cards but weak hierarchy between primary and secondary cards
  - top action bars are not fully standardized across major pages
  - floating action buttons accumulate visual weight in the lower-right corner
  - filter bars and compact selectors vary in density and prominence from page to page
  - empty or low-density areas on large monitors reduce perceived information efficiency
  - trust-critical finance/tax sections sometimes compress too much information into small bands
```

### 3.4 Per-Screen Interpretation

#### Dashboard

```yaml
screen_analysis:
  id: UI-IMG-01
  strengths:
    - revenue hero card is visually dominant in the right way
    - monthly calendar creates a strong operating-center feeling
    - notes and deadlines support the idea of a daily cockpit
  issues:
    - header utility strip is crowded: clock, billing shortcut, and quick recording compete for attention
    - right-side stat cards are visually secondary but still contain action affordances, creating ambiguity
    - calendar cell content becomes dense and hard to scan quickly
    - floating actions add another layer of decision noise
  polish_direction:
    - simplify header utilities
    - strengthen dashboard hierarchy around "today / attention / action"
    - reduce scan cost in calendar and support cards
```

#### Finances

```yaml
screen_analysis:
  id: UI-IMG-02_UI-IMG-03
  strengths:
    - strong premium visual treatment
    - annual revenue card and KPI structure already feel substantial
    - expense and invoice sections are functionally rich
  issues:
    - tax summary strip is too compressed for a trust-critical function
    - several KPI blocks are visually similar even though they have different importance
    - lower section mixes expenses, category distribution, trend, ads spend, and invoices with limited hierarchy
    - some typography is too faint for numbers the user needs to trust
  polish_direction:
    - distinguish strategic numbers from supportive metrics more clearly
    - give tax and invoice areas more breathing room and clearer labeling
    - reduce low-contrast decorative text
```

#### Clients

```yaml
screen_analysis:
  id: UI-IMG-04
  strengths:
    - client cards are visually clean and easy to differentiate
    - missing invoicing data banner is useful and actionable
  issues:
    - grid cards are attractive but information-dense status lines are too quiet
    - the warning banner is visually strong but can dominate the page when many clients are missing data
    - search and view toggle are present but not visually grouped as a control system
  polish_direction:
    - improve card info hierarchy
    - make client health/status clearer at a glance
    - reduce banner dominance while keeping it actionable
```

#### Projects

```yaml
screen_analysis:
  id: UI-IMG-05
  strengths:
    - progress bars are readable and project completion feels tangible
    - filter/search row is functionally appropriate
  issues:
    - project rows are tall, which reduces list density on large datasets
    - status chips, priority chips, invoiced state, and delete action compete in the same line
    - secondary metadata is visually weak relative to whitespace
  polish_direction:
    - tighten vertical rhythm
    - separate status semantics from destructive/system actions
    - improve list scan efficiency
```

#### Calendar

```yaml
screen_analysis:
  id: UI-IMG-06
  strengths:
    - two-panel structure is good for planning and detail
    - project progress section below calendar reinforces the operating-system concept
  issues:
    - detail pane becomes visually empty when no event is selected
    - event chips are small and truncation-heavy in month view
    - top-right controls are compact but not especially discoverable
  polish_direction:
    - make the right detail pane more useful in empty state
    - improve event readability in dense months
    - standardize calendar control prominence with other pages
```

#### Files

```yaml
screen_analysis:
  id: UI-IMG-07
  strengths:
    - page is calm, clear, and visually mature
    - folder color tinting works well
  issues:
    - very large empty areas reduce perceived utility on large screens
    - root-level grid could support more density or context without feeling cluttered
    - search, layout toggle, and add action feel slightly detached from the content block
  polish_direction:
    - increase information density selectively
    - improve top control grouping
    - preserve calmness while making the page feel less sparse
```

#### Notes Panel

```yaml
screen_analysis:
  id: UI-IMG-08
  strengths:
    - strong personality and useful floating utility behavior
    - card-based note browsing works well
  issues:
    - floating add button visually overlaps the content stack
    - card hierarchy between pinned, normal, and active work-in-progress can be clearer
    - search and list structure are usable but could better separate browsing from editing
  polish_direction:
    - improve action placement and list grouping
    - preserve the panel's identity while reducing visual friction
```

#### Settings

```yaml
screen_analysis:
  id: UI-IMG-09
  strengths:
    - left tab navigation is straightforward
    - form sections are readable and not overloaded
  issues:
    - content column is narrow relative to the available canvas, leaving a lot of unused space
    - settings sections feel utilitarian rather than intentionally structured
    - save/state feedback is not visually obvious from the screenshot
  polish_direction:
    - improve content width and grouping
    - make settings feel more like structured control panels than generic forms
```

#### Shared Shell

```yaml
screen_analysis:
  id: UI-IMG-10
  strengths:
    - shell is consistent across screens
    - sidebar feels desktop-native and brand-consistent
  issues:
    - top shortcut grid competes with primary navigation more than necessary
    - lower-right floating action cluster is powerful but visually heavy
    - the distinction between primary navigation and utilities could be clearer
  polish_direction:
    - tighten shell hierarchy
    - make global utilities feel deliberate rather than accumulated
```

## 4. Execution Rules For Agents

An agent must follow these rules when executing the plan.

```yaml
agent_rules:
  - modify_one_primary_screen_per_batch
  - optional_shared_system_change_is_allowed_only_if_required_by_that_screen
  - do_not_mix_business_logic_expansion_with_ui_polish
  - preserve_existing_routes_and_feature_scope
  - avoid_restyling_ads_module_unless_shared_base_shell_is_affected
  - prefer_consistency_over_originality
  - do_not_change_copy_unless_it_improves_clarity_or_error_prevention
  - do_not_add_more_widgets_to_dashboard
  - do_not_add_new_settings_tabs_or_navigation_items_in_this_plan
```

## 5. Validation Protocol

Every task batch must satisfy the same validation protocol.

```yaml
validation_protocol:
  code_validation:
    - run_targeted_error_check_for_edited_files
    - if_shared_layout_changes_were_made_check_layout_and_sidebar_files_too
  visual_validation:
    - confirm_primary_heading_is_visually_obvious_within_3_seconds
    - confirm_primary_action_is_identifiable_without_reading_all_text
    - confirm_secondary_text_is_readable_at_normal_zoom
    - confirm_destructive_actions_do_not_compete_with_primary_actions
    - confirm_spacing_is_consistent_with_neighboring_screens
    - confirm_no_dropdown_or_overlay_is_hidden_by_parent_containers
  regression_validation:
    - confirm_filters_and_dropdowns_still_work
    - confirm_route_navigation_is_unchanged
    - confirm_empty_states_and_loading_states_still_render
```

## 6. Error-Minimization Strategy

This plan is intentionally designed to minimize implementation risk.

```yaml
error_minimization:
  structural:
    - isolate_global_shell_tasks_from_screen_specific_tasks
    - isolate_visual_polish_from_tax_or_billing_logic
    - keep_each_task_small_and_reversible
  execution:
    - use_explicit_task_ids_and_dependencies
    - require_acceptance_criteria_before_marking_done
    - update_status_fields_after_each_batch
  product_safety:
    - treat_finances_and_settings_as_trust_critical
    - preserve_warning_and_status_visibility_even_when_reducing_visual_noise
    - preserve_existing_user_flows_before_improving_density_or_layout
```

## 7. Phase Plan

### Phase P0 - Shared System Polish

Goal:
- make the shell, hierarchy, and shared controls feel intentional before polishing individual screens

#### Task UX-001

```yaml
id: UX-001
phase: P0
title: establish_shared_page_header_spec
status: done
priority: p0
screen: shared_layout
depends_on: []
owner: agent
started_at: 2026-04-21
completed_at: 2026-04-21
files_hint:
  - src/components/Layout.tsx
  - src/components/Sidebar.tsx
  - src/components/TitleBar.tsx
goal:
  - unify page header spacing, title/subtitle rhythm, and right-side action grouping across base screens
acceptance_criteria:
  - dashboard, finances, clients, projects, calendar, files, and settings use a visibly related header rhythm
  - primary page title always outranks secondary chips, filters, or utility text
  - no page-specific header workaround is required for normal alignment
validation:
  - targeted_error_check
  - visual_compare_across_7_core_screens
  - get_errors: no errors in PageHeader.tsx and the 7 migrated core screens
  - visual intent: titles now consistently lead, subtitles sit directly beneath, and right-side actions align on the same rhythm
evidence:
  - added shared PageHeader component for a single reusable title/subtitle/actions structure
  - dashboard, finances, clients, projects, calendar, files, and settings now use the shared header rhythm
  - settings gained a proper page-level header above its tabbed admin layout
```

#### Task UX-002

```yaml
id: UX-002
phase: P0
title: simplify_global_utility_hierarchy
status: done
priority: p0
screen: shared_layout
depends_on: [UX-001]
owner: agent
started_at: 2026-04-21
completed_at: 2026-04-21
files_hint:
  - src/components/Layout.tsx
  - src/components/Sidebar.tsx
  - src/components/PomodoroTimer.tsx
goal:
  - reduce visual competition between sidebar shortcuts, primary nav, and bottom-right floating actions
acceptance_criteria:
  - primary navigation is visually dominant over shortcut utilities
  - floating actions read as one utility cluster, not separate competing CTAs
  - no global action visually collides with page-level actions
validation:
  - targeted_error_check
  - shell_only_visual_review
  - get_errors: no errors in Layout.tsx, Sidebar.tsx, PomodoroTimer.tsx
  - hierarchy intent: sidebar primary nav now visually outranks shortcut utilities, and floating utilities read as one grouped rail
evidence:
  - sidebar shortcut grid now sits inside a lighter-weight labeled utility section separate from the primary navigation
  - primary nav gained its own labeled section and retains the strongest shell emphasis
  - notes, pomodoro, and ads utilities now sit on a shared bottom-right utility rail with reduced CTA weight
```

#### Task UX-003

```yaml
id: UX-003
phase: P0
title: raise_secondary_text_legibility
status: done
priority: p0
screen: shared_visual_system
depends_on: []
owner: agent
started_at: 2026-04-21
completed_at: 2026-04-21
files_hint:
  - src/index.css
  - shared_screen_components_if_needed
goal:
  - improve low-contrast metadata text without breaking the dark visual style
acceptance_criteria:
  - helper text, meta rows, and timestamps are readable on standard displays
  - no trust-critical number uses decorative low contrast
validation:
  - targeted_error_check
  - contrast_spot_check_on_dashboard_finances_clients
  - get_errors: no errors in index.css, PageHeader.tsx, Dashboard.tsx, Finances.tsx, Clients.tsx
  - contrast intent: shared subtitle text and high-frequency metadata rows are stronger on the three validation screens
evidence:
  - added shared text tiers in src/index.css for stronger secondary and soft-muted text
  - PageHeader subtitle now uses the stronger shared secondary text tier
  - dashboard, finances, and clients low-contrast helper/meta text was selectively raised without changing business behavior
```

### Phase P1 - Dashboard Focus Polish

Goal:
- make the dashboard feel like a daily operating center, not a collection of unrelated cards

#### Task UX-101

```yaml
id: UX-101
phase: P1
title: simplify_dashboard_header_utilities
status: done
priority: p0
screen: dashboard
depends_on: [UX-001, UX-002]
owner: agent
started_at: 2026-04-21
completed_at: 2026-04-21
files_hint:
  - src/pages/Dashboard.tsx
goal:
  - reduce competition between clock, billing shortcut, and quick recording
acceptance_criteria:
  - header has one clear primary utility area
  - visual weight of utilities is lower than the main dashboard content
  - quick recording remains accessible without dominating the header
validation:
  - targeted_error_check
  - dashboard_header_visual_review
  - get_errors: no errors in Dashboard.tsx after header changes
  - header review: clock and billing shortcut now read as one subdued utility group, while quick recording remains the single clear action
evidence:
  - dashboard header now groups clock and billing access into a lower-emphasis utility cluster
  - quick recording remains accessible but is the only prominent header CTA
  - billing shortcuts use compact labeled buttons instead of large brand-dominant logo blocks
```

#### Task UX-102

```yaml
id: UX-102
phase: P1
title: rebalance_dashboard_card_hierarchy
status: done
priority: p0
screen: dashboard
depends_on: [UX-101, UX-003]
owner: agent
started_at: 2026-04-21
completed_at: 2026-04-21
files_hint:
  - src/pages/Dashboard.tsx
goal:
  - clarify what matters now: revenue, schedule, recent notes, near deadlines
acceptance_criteria:
  - one hero block and one secondary support zone are visually obvious
  - minor stat cards do not visually compete with the calendar
  - notes and deadlines cards feel purposeful, not leftover side widgets
validation:
  - targeted_error_check
  - dashboard_3_second_scan_test
  - get_errors: no errors in Dashboard.tsx after hierarchy changes
  - 3-second scan intent: hero revenue block, calendar, and right-side focus zone now read as three distinct layers without mini-stat cards competing equally
evidence:
  - revenue section now reads as the single dashboard hero block
  - active clients and active projects are grouped into one labeled support zone with calmer actions
  - notes and deadlines are regrouped into a shared "Mai fókusz" support panel instead of reading as leftover side widgets
```

#### Task UX-103

```yaml
id: UX-103
phase: P1
title: improve_dashboard_calendar_density
status: todo
priority: p1
screen: dashboard
depends_on: [UX-102]
files_hint:
  - src/pages/Dashboard.tsx
goal:
  - improve event chip readability and reduce scan friction inside the dashboard calendar
acceptance_criteria:
  - dense months remain legible without overwhelming the card
  - truncation feels controlled rather than accidental
  - selected day and current day remain visually obvious
validation:
  - targeted_error_check
  - dense_month_visual_check
evidence: []
```

### Phase P2 - Finances Trust Polish

Goal:
- make finances feel more trustworthy, more readable, and less visually fragmented

#### Task UX-201

```yaml
id: UX-201
phase: P2
title: expand_finance_trust_hierarchy
status: todo
priority: p0
screen: finances
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Finances.tsx
  - src/components/TaxSection.tsx
goal:
  - separate strategic financial numbers from supporting context and from advisory content
acceptance_criteria:
  - annual revenue, monthly revenue, and total tax summary are immediately distinguishable
  - critical totals use stronger contrast than descriptive helper text
  - tax strip is easier to parse without adding extra features
validation:
  - targeted_error_check
  - finance_readability_review
evidence: []
```

#### Task UX-202

```yaml
id: UX-202
phase: P2
title: simplify_finance_mid_and_lower_sections
status: todo
priority: p1
screen: finances
depends_on: [UX-201]
files_hint:
  - src/pages/Finances.tsx
goal:
  - reduce visual fragmentation in KPI, expenses, distribution, trend, and invoice sections
acceptance_criteria:
  - related cards feel grouped by purpose
  - expense and invoice blocks are easier to scan linearly
  - conditional ads spend block remains visually subordinate when present
validation:
  - targeted_error_check
  - finance_below_fold_review
evidence: []
```

#### Task UX-203

```yaml
id: UX-203
phase: P2
title: standardize_finance_filters_and_table_controls
status: todo
priority: p1
screen: finances
depends_on: [UX-202]
files_hint:
  - src/pages/Finances.tsx
goal:
  - make invoice controls and filter states feel consistent with the rest of the app
acceptance_criteria:
  - status, client, and date filters align visually and behaviorally
  - primary finance actions are easy to find at first glance
  - table headers and rows have a stronger scan rhythm
validation:
  - targeted_error_check
  - table_filter_interaction_check
evidence: []
```

### Phase P3 - Client and Project Operations Polish

Goal:
- sharpen the day-to-day operational screens where users spend the most time browsing and acting

#### Task UX-301

```yaml
id: UX-301
phase: P3
title: clarify_client_card_status_hierarchy
status: todo
priority: p0
screen: clients
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Clients.tsx
goal:
  - make each client card easier to read as a business status object, not just a name card
acceptance_criteria:
  - client name, company, health state, and activity state have a clear visual order
  - warning badges do not overpower the card title
  - grid/list toggle and search behave as one control group
validation:
  - targeted_error_check
  - client_card_scan_test
evidence: []
```

#### Task UX-302

```yaml
id: UX-302
phase: P3
title: reduce_missing_data_banner_dominance
status: todo
priority: p1
screen: clients
depends_on: [UX-301]
files_hint:
  - src/pages/Clients.tsx
goal:
  - keep the invoicing-data warning actionable while reducing its dominance over the actual client grid
acceptance_criteria:
  - warning remains visible and actionable
  - client list stays the visual primary content area
validation:
  - targeted_error_check
  - clients_banner_balance_review
evidence: []
```

#### Task UX-303

```yaml
id: UX-303
phase: P3
title: tighten_project_list_density
status: todo
priority: p0
screen: projects
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Projects.tsx
goal:
  - make the project list faster to scan without reducing important project state information
acceptance_criteria:
  - more projects fit comfortably within the same viewport
  - status chips and action icons no longer feel crowded into one line
  - progress remains highly readable
validation:
  - targeted_error_check
  - project_list_density_review
evidence: []
```

#### Task UX-304

```yaml
id: UX-304
phase: P3
title: standardize_project_filter_bar
status: todo
priority: p1
screen: projects
depends_on: [UX-303]
files_hint:
  - src/pages/Projects.tsx
goal:
  - align project filter/search visuals with finances and clients control patterns
acceptance_criteria:
  - search and all filters read as a single coherent tool row
  - primary create action is clearly separated from filter controls
validation:
  - targeted_error_check
  - cross_screen_control_compare
evidence: []
```

### Phase P4 - Calendar and Files Utility Polish

Goal:
- improve information efficiency on two utility-heavy screens without cluttering them

#### Task UX-401

```yaml
id: UX-401
phase: P4
title: improve_calendar_empty_and_detail_states
status: todo
priority: p1
screen: calendar
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Calendar.tsx
goal:
  - make the right-hand detail panel useful even when there is no selected event detail to show
acceptance_criteria:
  - empty detail state feels intentional, not blank
  - selected date and available next actions are clear
validation:
  - targeted_error_check
  - calendar_empty_state_review
evidence: []
```

#### Task UX-402

```yaml
id: UX-402
phase: P4
title: improve_calendar_event_legibility
status: todo
priority: p1
screen: calendar
depends_on: [UX-401]
files_hint:
  - src/pages/Calendar.tsx
goal:
  - reduce event-chip truncation pain in month view and improve scan speed
acceptance_criteria:
  - dense dates remain interpretable
  - visual distinction between work, deadline, reminder, and tax items remains intact
validation:
  - targeted_error_check
  - calendar_dense_month_review
evidence: []
```

#### Task UX-403

```yaml
id: UX-403
phase: P4
title: increase_files_information_density
status: todo
priority: p1
screen: files
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Files.tsx
goal:
  - make the files root and top control row feel less sparse on large screens
acceptance_criteria:
  - controls and content feel grouped
  - large empty areas are reduced without making the screen busy
  - file and folder cards retain their calm visual quality
validation:
  - targeted_error_check
  - files_large_screen_review
evidence: []
```

### Phase P5 - Notes and Settings Polish

Goal:
- improve two high-value support surfaces that strongly affect perceived product maturity

#### Task UX-501

```yaml
id: UX-501
phase: P5
title: clean_up_notes_panel_action_hierarchy
status: todo
priority: p1
screen: notes_panel
depends_on: [UX-002, UX-003]
files_hint:
  - src/components/NotesPanel.tsx
goal:
  - reduce interference between the floating add action, note cards, and browsing flow
acceptance_criteria:
  - adding a note is obvious but does not obscure content
  - pinned, highlighted, and normal notes have a clearer grouping logic
  - browsing and editing states feel more intentionally separated
validation:
  - targeted_error_check
  - notes_panel_interaction_review
evidence: []
```

#### Task UX-502

```yaml
id: UX-502
phase: P5
title: improve_settings_layout_density
status: todo
priority: p1
screen: settings
depends_on: [UX-001, UX-003]
files_hint:
  - src/pages/Settings.tsx
goal:
  - make the settings content area feel more intentional and less empty on desktop resolutions
acceptance_criteria:
  - settings content uses the canvas more effectively
  - section grouping is clearer
  - primary account and company settings read as one coherent admin surface
validation:
  - targeted_error_check
  - settings_desktop_review
evidence: []
```

#### Task UX-503

```yaml
id: UX-503
phase: P5
title: improve_settings_feedback_and_actions
status: todo
priority: p2
screen: settings
depends_on: [UX-502]
files_hint:
  - src/pages/Settings.tsx
goal:
  - make dangerous actions, save states, and account actions easier to understand
acceptance_criteria:
  - destructive actions are visually separated from standard configuration actions
  - save success or pending-change states are easy to notice
validation:
  - targeted_error_check
  - settings_action_clarity_review
evidence: []
```

### Phase P6 - Detail-Screen Reserve Wave

Goal:
- polish high-value detail screens that are strategically important but not directly evidenced in the attached screenshots

#### Task UX-601

```yaml
id: UX-601
phase: P6
title: client_detail_operating_hub_polish
status: todo
priority: p2
screen: client_detail
depends_on: [UX-301, UX-302]
files_hint:
  - src/pages/ClientDetail.tsx
goal:
  - strengthen ClientDetail as the main operating hub for work tied to a client
acceptance_criteria:
  - tabs and sections feel intentionally prioritized
  - actions related to invoices, notes, files, and projects are easier to discover
validation:
  - targeted_error_check
  - client_detail_flow_review
evidence: []
```

#### Task UX-602

```yaml
id: UX-602
phase: P6
title: project_detail_workflow_polish
status: todo
priority: p2
screen: project_detail
depends_on: [UX-303, UX-304]
files_hint:
  - src/pages/ProjectDetail.tsx
goal:
  - improve the sense that ProjectDetail is for doing work, not just viewing metadata
acceptance_criteria:
  - time, status, invoice linkage, and notes/files are easier to scan and act on
validation:
  - targeted_error_check
  - project_detail_flow_review
evidence: []
```

## 8. Suggested Execution Order

```yaml
recommended_order:
  - UX-001
  - UX-003
  - UX-002
  - UX-101
  - UX-102
  - UX-103
  - UX-201
  - UX-202
  - UX-203
  - UX-301
  - UX-303
  - UX-302
  - UX-304
  - UX-401
  - UX-402
  - UX-403
  - UX-501
  - UX-502
  - UX-503
  - UX-601
  - UX-602
```

## 9. Agent Workflow

An agent should use the following loop.

```yaml
agent_workflow:
  step_1:
    action: read_this_plan
    output: identify_next_todo_with_no_unmet_dependencies
  step_2:
    action: gather_targeted_context_for_that_task_only
    output: files_and_components_to_edit
  step_3:
    action: implement_smallest_viable_polish_change
    output: one_coherent_batch
  step_4:
    action: run_targeted_validation
    output: error_status_and_visual_check_notes
  step_5:
    action: update_task_metadata_in_this_file
    output:
      - status
      - owner
      - started_at
      - completed_at
      - evidence
      - validation
  step_6:
    action: summarize_user_visible_change
    output: short_human_summary
```

## 10. Definition Of Done For The Plan

```yaml
plan_done_when:
  - all_p0_tasks_are_done
  - dashboard_finances_clients_projects_calendar_files_notes_settings_have_each_received_at_least_one_polish_pass
  - trust_critical_screens_have_clearer_hierarchy_than_the_baseline_screenshots
  - no_open_regression_in_dropdowns_filters_or_navigation
  - the_base_klient_feels_more_focused_without_losing_its_operational_depth
```
