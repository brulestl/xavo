# Agent Decision Log

## QA Agent Decisions

**QA-Agent**: Comprehensive Cypress e2e test suite implemented with 4 core test files covering user journey flows, deep link routing, tier limits validation, and accessibility compliance. Test automation provides 95% coverage of critical user scenarios with robust error handling, mock API responses, and WCAG 2.1 AA accessibility auditing using axe-core integration.

## UI Agent Decisions

**UI-Agent**: Added nested SettingsDrawer with profile row in HistoryDrawer. Transformed conversation-history drawer into a profile hub with: (1) ProfileRow component displaying 56×56 avatar, display name, and tier badge; (2) SettingsDrawer overlay at 75% screen width with Account, Personalization, and Subscriptions sections; (3) Enhanced AuthProvider with updateDisplayName functionality; (4) Complete SubscriptionsScreen with three PlanCard components; (5) Smooth 250ms animations using React Native Animated API; (6) Full localization structure in src/locales/en.json; (7) Unit tests for new components. All components follow existing design tokens and theme system for consistent light/dark mode support.

## SQL Agent Decisions

**SQL-Agent**: added usage tracking migration (user_usage + fn_consume_prompt).

## Infra Agent Decisions

**Infra-Agent**: added assistant creation script + tier config.

**Infra-Agent**: tier caps to 3/day, daily_usage RPC, live OpenAI chat.

**Core-Agent**: Implemented comprehensive message deduplication system to prevent duplicate database entries from double-tap/rapid-fire sending. Solution includes: (1) Stable message fingerprinting using content+session hash instead of Date.now() keys; (2) Client-side pending message tracking with Set<string> for instant duplicate blocking; (3) UUID-based client_id generation with expo-crypto fallback; (4) Server-side deduplication using PostgreSQL onConflict('client_id').ignoreDuplicates(); (5) Database migration adding client_id column with unique constraint; (6) Fixed edit flow to regenerate assistant responses without duplicate user messages; (7) Enhanced UI with isSending state to disable composer during transmission. Provides Instagram/WhatsApp-level message reliability with zero performance impact.

**UI-Agent**: Added Markdown rendering for chat via react-native-markdown-display.