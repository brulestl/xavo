# Relationship Coach App

A React Native app built with Expo that provides AI-powered relationship coaching with tiered authentication and usage limits.

## Features

- **Tiered Authentication**: Guest (3 daily queries), Essential Coach (3 daily queries), Power Strategist (unlimited)
- **Supabase Integration**: Email/password and OAuth authentication (Google, LinkedIn)
- **Theme System**: Light/dark mode with custom color palette
- **Query Limiting**: Daily usage tracking with SecureStore persistence
- **Drawer Navigation**: Tier-specific menu items and usage counters
- **Mock AI Responses**: Realistic relationship coaching conversations

## Design System

### Color Palette
| Token | Hex | Light Theme Usage | Dark Theme Usage |
|-------|-----|------------------|------------------|
| platinum | #CFDBD5 | Card backgrounds, borders | Card backgrounds |
| alabaster | #E8EDDF | Screen backgrounds | Text headings |
| saffron | #F5CB5C | Primary accent (buttons) | Accent |
| eerieBlack | #242423 | Text, dark backgrounds | Screen backgrounds |
| jet | #333533 | Dividers, shadows | Surface backgrounds |

### Components
- **Button**: Rounded-full design with saffron accent, 40% opacity when disabled
- **Container**: Flexible layout component with variant-based styling
- **ThemeProvider**: Automatic light/dark theme switching with AsyncStorage persistence

## Setup Instructions

### 1. Environment Configuration
```bash
# Copy the environment template
cp .env.sample .env

# Add your Supabase credentials to .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Start Development Server
```bash
npx expo start
```

## Project Structure

```
src/
├── components/
│   ├── Button.tsx          # Themed button component
│   └── Container.tsx       # Layout container component
├── navigation/
│   └── DrawerNavigator.tsx # Main drawer navigation
├── providers/
│   ├── AuthProvider.tsx    # Supabase auth & tier management
│   └── ThemeProvider.tsx   # Light/dark theme system
└── screens/
    ├── SplashScreen.tsx    # Logo fade-in screen
    ├── WelcomeScreen.tsx   # First questions intro
    ├── AuthChoiceScreen.tsx # Login/signup choice
    ├── LoginSignupScreen.tsx # Auth forms
    ├── DashboardScreen.tsx # Main chat interface
    ├── ChatScreen.tsx      # AI conversation UI
    └── AccountScreen.tsx   # User profile & settings
```

## User Flows

### Guest Flow
1. Splash → Welcome → Get Started → AuthChoice
2. Can access chat with 3 daily query limit
3. Drawer shows "Log In" and "Sign Up" options

### Authenticated Flow
1. Login → Dashboard (ChatScreen)
2. Essential: 3 daily queries, personalized coaching
3. Power: Unlimited queries, voice input, premium features
4. Drawer shows "Relationships" and "Account"

## Authentication Tiers

### Guest (Free)
- 3 daily AI conversations
- Basic relationship coaching
- General advice and tips

### Essential Coach
- 3 daily AI conversations
- Personalized coaching
- Relationship strategies
- Priority support

### Power Strategist
- Unlimited AI conversations
- Advanced coaching techniques
- Voice input support
- Premium relationship content
- Priority support

## Technical Features

- **Daily Query Reset**: Automatic midnight reset using date comparison
- **Secure Storage**: User preferences and query counts persisted locally
- **Navigation Guards**: Tier-based access control
- **Mock Responses**: 5 realistic AI coaching responses for testing
- **Theme Persistence**: User theme preference saved across sessions

## Development

The app uses mock data for AI responses until backend endpoints are ready. All authentication flows are functional with Supabase integration.

### Testing
- Scan QR code with Expo Go app
- Test guest flow (3 query limit)
- Test authentication with email/password
- Verify theme switching
- Check drawer navigation for different tiers

## Deployment

Ready for EAS Build and App Store deployment with proper Supabase configuration. 