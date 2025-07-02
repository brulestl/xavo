# Shark Mode Toggle Implementation Summary

## ✅ What We've Implemented

### 1. **TierContext** (`src/contexts/TierContext.tsx`)
- Manages tier state across the app ('trial', 'strategist', 'shark')
- Loads tier from Supabase `user_profiles` table on app start
- Provides `setTier()` function that updates both local state and Supabase
- Optimistic updates for instant UI feedback

### 2. **SharkToggleIcon Component** (`src/components/SharkToggleIcon.tsx`)
- Theme-aware icon selection:
  - **Light mode**: `media/logo/logo_eerie-black_67.png`  
  - **Dark mode**: `media/logo/logo_platinum_67_darkmode.png`
- Shows "ON" badge in brand green when `tier === 'shark'`
- One-tap toggle between 'shark' ↔ 'strategist'
- Persists changes to Supabase automatically

### 3. **Header Integration**
Updated both screen headers to include the Shark toggle:

#### HomeScreen Header:
```tsx
{/* Header Right: Shark Toggle + Settings */}
<View style={{ flexDirection: 'row', gap: 8, marginRight: -8 }}>
  <SharkToggleIcon />
  <TouchableOpacity onPress={openSettings}>
    <Ionicons name="settings-outline" size={24} />
  </TouchableOpacity>
</View>
```

#### ChatScreen Header:
```tsx
{/* Header Right: Shark Toggle + Settings */}
<View style={{ flexDirection: 'row', gap: 8, marginRight: -8 }}>
  <SharkToggleIcon />
  <TouchableOpacity onPress={openSettings}>
    <Ionicons name="settings-outline" size={24} />
  </TouchableOpacity>
</View>
```

### 4. **App Provider Wrapping** (`App.tsx`)
```tsx
<ThemeProvider>
  <AuthProvider>
    <TierProvider>  {/* ← Added */}
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </TierProvider>
  </AuthProvider>
</ThemeProvider>
```

### 5. **Backend Integration** (`supabase/functions/chat/index.ts`)
- Fetches user tier from `user_profiles` table
- Uses tier-specific system prompts:
  - **Shark**: Aggressive, tactical, political warfare prompt
  - **Strategist**: Professional, strategic coaching prompt  
- Uses tier-specific models:
  - **Shark**: `gpt-4o` (will use o3 when available)
  - **Strategist**: `gpt-4o`
  - **Trial**: `gpt-4o-mini`

### 6. **Prompt System** (`src/utils/promptUtils.ts`)
- `getSystemPrompt(tier)`: Returns appropriate prompt for tier
- `getModelForTier(tier)`: Returns appropriate OpenAI model
- Fallback handling for missing prompt files

## 🎯 User Experience Flow

1. **Icon Display**: Users see a shark icon next to the gear icon in both Home and Chat headers
2. **Theme Adaptation**: Icon automatically switches based on light/dark theme
3. **One-Tap Toggle**: Tapping instantly switches between Shark ↔ Strategist mode
4. **Visual Feedback**: "ON" badge appears below icon when Shark mode is active
5. **Persistence**: Choice is immediately saved to Supabase `user_profiles.tier`
6. **Chat Behavior**: All subsequent LLM calls use Shark prompt + appropriate model

## 🔧 Technical Details

### Theme Integration
- Uses `useTheme()` hook for light/dark detection
- Icons swap automatically based on `isDark` state
- Brand green (`theme.colors.growthGreen`) for "ON" badge

### State Management
- TierContext provides global tier state
- Optimistic updates for instant UI response
- Error handling with rollback on Supabase failures

### Database Schema
Requires `user_profiles` table with:
```sql
CREATE TABLE user_profiles (
  user_id UUID REFERENCES auth.users(id),
  tier TEXT DEFAULT 'strategist',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🚀 Next Steps for Production

1. **Test on Both Platforms**: Verify iOS and Android behavior
2. **Error Handling**: Add user notifications for toggle failures
3. **Analytics**: Track Shark mode usage patterns
4. **A/B Testing**: Measure impact on user engagement
5. **Model Upgrade**: Switch to o3 when available from OpenAI

## ✨ Key Features Delivered

- ✅ One-tap Shark Mode toggle in every header
- ✅ Theme-aware icon swapping (light/dark)
- ✅ Visual "ON" indicator with brand styling
- ✅ Persistent tier storage in Supabase
- ✅ LLM prompt/model switching based on tier
- ✅ Optimistic UI updates for instant feedback
- ✅ Error handling and fallbacks
- ✅ Consistent header design across screens

The implementation is complete and ready for testing! 🦈 