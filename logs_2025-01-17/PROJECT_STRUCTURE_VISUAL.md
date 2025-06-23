# 📁 Corporate Influence Coach - Complete Project Structure

## 🎯 Project Overview
```
influence/
├── 📱 Frontend (React Native + Expo)
├── 🔧 Backend (NestJS API)
├── 📊 Database (Supabase)
├── 🤖 AI Integration (OpenAI Assistants)
├── 📋 Documentation & Guides
└── ⚙️ Configuration & Tools
```

---

## 📱 **FRONTEND STRUCTURE**

### 🎨 **Modern Frontend** (`src/`)
```
src/
├── 🖼️ screens/
│   ├── WelcomeScreen.tsx           # Landing page with auth options
│   ├── AuthChoiceScreen.tsx        # Login/Signup choice
│   ├── LoginSignupScreen.tsx       # Email/OAuth authentication
│   ├── OnboardingScreen.tsx        # Two-step onboarding flow
│   ├── PersonalityQuizScreen.tsx   # Personality assessment
│   ├── PersonalizationScreen.tsx   # User preferences
│   ├── HomeScreen.tsx              # Main dashboard
│   ├── ChatScreen.tsx              # AI coaching interface
│   ├── DashboardScreen.tsx         # User dashboard
│   ├── HistoryScreen.tsx           # Chat history
│   ├── AccountScreen.tsx           # User account settings
│   ├── SettingsScreen.tsx          # App settings
│   ├── SubscriptionsScreen.tsx     # Tier management
│   ├── OnboardingEditScreen.tsx    # Edit onboarding data
│   └── SplashScreen.tsx            # App loading screen
│
├── 🧩 components/
│   ├── ui/
│   │   ├── TierBadge.tsx           # User tier display
│   │   ├── PlanCard.tsx            # Subscription plans
│   │   └── ProfileRow.tsx          # Profile information row
│   ├── Button.tsx                  # Reusable button component
│   ├── ChatBubble.tsx              # Chat message bubbles
│   ├── Composer.tsx                # Message input component
│   ├── Container.tsx               # Layout container
│   ├── Drawer.tsx                  # Side navigation drawer
│   ├── ListItem.tsx                # List item component
│   ├── Pill.tsx                    # Pill-shaped buttons
│   ├── PillPrompt.tsx              # Suggested prompts
│   ├── SearchBar.tsx               # Search input
│   ├── SettingsDrawer.tsx          # Settings side panel
│   ├── ActionButton.tsx            # Action buttons for chat
│   ├── Timestamp.tsx               # Time display
│   └── TypingDots.tsx              # Typing indicator
│
├── 🎣 hooks/
│   ├── useAuth.ts                  # Authentication logic
│   ├── useChat.ts                  # Chat functionality
│   ├── useDrawerControls.ts        # Drawer state management
│   └── (additional hooks)
│
├── 🎨 providers/
│   ├── AuthProvider.tsx            # Authentication context
│   └── ThemeProvider.tsx           # Theme management
│
├── 🧭 navigation/
│   └── DrawerNavigator.tsx         # Main navigation setup
│
├── 🛠️ utils/
│   └── credits.ts                  # Credit management utilities
│
├── 🌐 locales/
│   └── en.json                     # English translations
│
└── 🧪 __tests__/
    ├── components/                 # Component tests
    ├── providers/                  # Provider tests
    ├── ChatBubble.test.tsx
    └── TypingDots.test.tsx
```

### 📜 **Legacy Frontend** (Root Level)
```
├── screens/                        # Legacy screen implementations
│   ├── AccountScreen.tsx
│   ├── ChatScreen.tsx              # ⚠️ Duplicate implementation
│   ├── Dashboard.tsx
│   ├── HomeScreen.tsx
│   ├── LoginSignupScreen.tsx
│   ├── OnboardingIntro.tsx
│   ├── OnboardingLoginChoice.tsx
│   ├── PaywallScreen.tsx
│   └── SplashScreen.tsx
│
├── components/                     # Legacy components
│   ├── ChatComposer.tsx
│   ├── ChatScreen.tsx              # ⚠️ Another duplicate
│   ├── InsightsDrawer.tsx
│   ├── OnboardingScreen.tsx
│   ├── PaywallBottomSheet.tsx
│   └── ProfileModal.tsx
│
├── contexts/                       # Legacy contexts
│   └── AuthContext.tsx             # ⚠️ Conflicts with AuthProvider
│
├── hooks/                          # Legacy hooks
│   ├── useAuth.ts
│   ├── useChat.ts
│   ├── useConversations.ts
│   ├── useMemory.ts
│   ├── useOnboarding.ts
│   └── useProfile.ts
│
└── utils/                          # Legacy utilities
    └── AttemptLimiter.ts
```

### 📱 **Platform Specific**
```
├── android/                        # Android build configuration
│   ├── app/
│   │   ├── build.gradle
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/brulestl/
│   │   │   └── res/
│   │   └── debug.keystore
│   ├── gradle/
│   └── settings.gradle
│
├── xavo/                           # Alternative Expo Router structure
│   ├── app/
│   │   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   └── +not-found.tsx
│   ├── components/
│   ├── hooks/
│   └── constants/
│
└── assets/                         # Static assets
    ├── icon.png
    ├── splash-icon.png
    ├── adaptive-icon.png
    └── favicon.png
```

---

## 🔧 **BACKEND STRUCTURE**

### 🏗️ **API Source** (`api/src/`)
```
api/src/
├── 🏗️ modules/
│   ├── 🔐 auth/
│   │   ├── auth.service.ts         # JWT validation & user management
│   │   ├── auth.guard.ts           # Route protection
│   │   └── auth.module.ts
│   │
│   ├── 💬 chat/
│   │   ├── chat.controller.ts      # Main chat endpoint
│   │   ├── chat.service.ts         # Chat processing logic
│   │   ├── enhanced-chat.service.ts # Advanced chat features
│   │   ├── model-router.service.ts # AI model routing
│   │   ├── openai-function-tools.ts # OpenAI function definitions
│   │   ├── dto/
│   │   │   ├── chat.dto.ts         # Chat request/response types
│   │   │   └── enhanced-chat.dto.ts # Extended chat types
│   │   └── chat.module.ts
│   │
│   ├── 👤 profile/
│   │   ├── profile.controller.ts   # Profile management endpoints
│   │   ├── profile.service.ts      # Profile business logic
│   │   ├── dto/profile.dto.ts      # Profile data types
│   │   └── profile.module.ts
│   │
│   ├── 📝 onboarding/
│   │   ├── onboarding.controller.ts # Onboarding endpoints
│   │   ├── onboarding.service.ts   # Onboarding logic
│   │   ├── dto/onboarding.dto.ts   # Onboarding data types
│   │   ├── __tests__/
│   │   │   └── onboarding.service.spec.ts
│   │   └── onboarding.module.ts
│   │
│   ├── 🧠 memory/
│   │   ├── memory.service.ts       # Conversation memory
│   │   ├── enhanced-memory.service.ts # Advanced memory features
│   │   ├── memory.types.ts         # Memory data types
│   │   ├── dto/enhanced-memory.dto.ts
│   │   └── memory.module.ts
│   │
│   ├── 🔍 rag/
│   │   ├── rag.service.ts          # Retrieval Augmented Generation
│   │   └── rag.module.ts
│   │
│   └── 📊 embeddings/
│       ├── openai-embeddings.service.ts # Text embeddings
│       ├── embeddings-worker.service.ts # Background processing
│       ├── embeddings.interface.ts
│       └── embeddings.module.ts
│
├── ⚙️ config/
│   └── plans.ts                    # Tier limits and features
│
├── 🛠️ utils/
│   ├── credits.ts                  # Usage tracking utilities
│   └── context-builder.util.ts    # Context building helpers
│
├── 🧪 __tests__/
│   ├── setup.ts                    # Test configuration
│   └── app.controller.spec.ts      # Controller tests
│
├── app.controller.ts               # Health check endpoints
├── app.service.ts                  # App-level services
├── app.module.ts                   # Main application module
└── main.ts                         # Application bootstrap
```

### 📦 **Build & Config**
```
api/
├── dist/                           # Compiled JavaScript output
├── database/
│   └── supabase-schema.sql         # Database schema
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── jest.config.js                  # Testing configuration
├── nodemon.json                    # Development server config
└── railway.json                    # Deployment configuration
```

---

## 📊 **DATABASE STRUCTURE**

### 🗄️ **Supabase Tables**
```
Database Schema:
├── 👥 User Management
│   ├── users                       # Supabase auth users
│   ├── user_profiles               # Extended user information
│   └── user_personalization        # User preferences & personality
│
├── 📝 Onboarding System
│   ├── onboarding_questions        # Dynamic question bank
│   └── onboarding_answers          # User responses
│
├── 💬 Chat System
│   ├── conversation_sessions       # Chat sessions
│   ├── conversation_messages       # Individual messages
│   └── short_term_contexts         # Session summaries
│
├── 📊 Usage Tracking
│   └── daily_usage                 # Credit consumption tracking
│
└── 🧠 Memory System
    ├── long_term_memories          # Persistent user insights
    └── embeddings_cache            # Vector embeddings
```

### ⚡ **Database Functions**
```
Stored Procedures:
├── fn_consume_prompt               # Credit consumption & limits
├── fn_calculate_personality_scores # Personality assessment
└── fn_insert_or_update_personalization # Profile management
```

### 📜 **SQL Scripts**
```
sql/
├── usage.sql                       # Usage tracking implementation
└── database/
    └── supabase-schema.sql         # Complete schema definition
```

---

## 🤖 **AI INTEGRATION**

### 🧠 **OpenAI Assistants**
```
AI Components:
├── 🤖 Created Assistants
│   ├── Xavo Coach                  # asst_KN1ILsjsb8LwwM0rjJbjCAla (GPT-4o-mini)
│   └── Xavo Curator                # asst_DORHBP1vBtBYFNslRxzatLHE (GPT-4o)
│
├── 📂 assistants/
│   └── map.ts                      # Assistant ID mapping
│
├── 📂 prompts/
│   ├── coach.txt                   # Coaching assistant prompt
│   └── curator.txt                 # Curation assistant prompt
│
└── 📂 scripts/
    └── createAssistants.ts         # Assistant creation script
```

---

## 📋 **DOCUMENTATION**

### 📊 **Analysis & Reports**
```
Documentation:
├── SYSTEM_INTEGRATION_ANALYSIS.md  # Complete system analysis (85% complete)
├── OAuth_Setup_Guide.md           # OAuth implementation guide
├── QA_TEST_PLAN.md                # Testing strategy
├── PROJECT_SUMMARY.md             # Project overview
├── UI_UX_IMPROVEMENTS_SUMMARY.md  # UI/UX enhancements
├── PROFILE_SETTINGS_DRAWER_SUMMARY.md # Settings implementation
├── OAuth_Fix_Summary.md           # OAuth troubleshooting
├── QA_IMPLEMENTATION_SUMMARY.md   # QA implementation details
└── DEVOPS_README.md               # DevOps setup guide
```

### 📂 **Structured Documentation**
```
docs/
├── tasks/
│   ├── corporate-influence-ui.md   # UI task specifications
│   └── theme-provider.md           # Theme system documentation
│
sprint1_databaseAndUi/
├── Back-End_MVP.txt               # Backend implementation guide
├── Database_Implementation_Guide.txt # Database setup
├── ai_rag_plumbing.txt            # AI/RAG integration
└── database_hardening_automation.sql # Security hardening
```

### 📝 **Business Documentation**
```
Business Files:
├── corporate politics.txt          # Business context
├── Onboarding Flow Questions.txt   # Onboarding design
└── media/logo/                     # Brand assets
    ├── logo_alabaster_67.png
    ├── logo_eerie-black_67.png
    ├── logo_jet_67.png
    ├── logo_platinum_67.png
    └── logo_saffron_67.png
```

---

## ⚙️ **CONFIGURATION & TOOLS**

### 🔧 **Root Configuration**
```
Configuration Files:
├── package.json                    # Main dependencies & scripts
├── package-lock.json              # Dependency lock file
├── tsconfig.json                   # TypeScript configuration
├── babel.config.js                # Babel transpilation
├── tailwind.config.js             # Tailwind CSS setup
├── app.json                        # Expo configuration
├── eas.json                        # Expo Application Services
├── .env                           # Environment variables
├── .eslintrc.js                   # Code linting rules
├── jest.config.js                 # Testing framework
├── jest.setup.js                  # Test setup
├── commitlint.config.js           # Commit message linting
└── index.ts                       # Entry point
```

### 🧪 **Testing Infrastructure**
```
Testing:
├── cypress/                       # E2E testing
│   ├── e2e/
│   │   ├── accessibility.cy.js    # Accessibility tests
│   │   ├── deep-links.cy.js       # Deep linking tests
│   │   ├── tier-limits.cy.js      # Tier functionality tests
│   │   └── user-journey.cy.js     # User flow tests
│   ├── fixtures/
│   │   └── test-data.json         # Test data
│   └── support/
│       ├── commands.js            # Custom commands
│       ├── component.js           # Component testing
│       └── e2e.js                 # E2E setup
│
└── cypress.config.js              # Cypress configuration
```

### 📊 **Data & Configuration**
```
Data Files:
├── data/
│   └── mockConversations.json     # Mock chat data
├── config/
│   └── plans.ts                   # Tier configuration
└── .storybook/
    └── main.js                    # Storybook configuration
```

### 🌐 **Build Artifacts**
```
Generated Files:
├── .expo/                         # Expo build cache
│   ├── devices.json
│   ├── packager-info.json
│   ├── settings.json
│   └── web/cache/
└── android/build/                 # Android build artifacts
```

---

## 🎯 **Key Integration Points**

### 🔄 **Data Flow**
```
User Request → Frontend (React Native) → Backend (NestJS) → Database (Supabase) → AI (OpenAI) → Response
```

### 🔗 **Critical Connections**
- **Frontend ↔ Backend**: REST API calls with JWT authentication
- **Backend ↔ Database**: Supabase client with RLS policies
- **Backend ↔ AI**: OpenAI Assistant API integration
- **Frontend ↔ Database**: Direct Supabase client for auth
- **Usage Tracking**: Real-time credit consumption via `fn_consume_prompt`

### ⚠️ **Known Issues**
1. **Multiple Chat Implementations** - Need consolidation
2. **Chat History Disconnection** - Frontend uses mock data
3. **AI Integration Gap** - Responses are mocked, not using real assistants

---

## 📈 **Project Status: 85% Complete**

✅ **Fully Functional**: Authentication, Onboarding, Tier System, Database, Backend API
⚠️ **Needs Work**: Chat History Integration, Real AI Responses, Code Consolidation
🔄 **In Progress**: OpenAI Assistant Integration, Frontend-Backend Chat Connection 