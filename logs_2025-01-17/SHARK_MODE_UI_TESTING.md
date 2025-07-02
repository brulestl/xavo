# Shark-Mode UI Testing Guide

This guide covers testing the new shark-mode functionality implemented in the SharkToggleIcon component.

## 🎯 Feature Overview

The shark-mode icon now has different behavior based on the user's subscription tier:

### Visual States
- **OFF State**: Red border around shark icon (all tiers)
- **ON State**: Green border around shark icon (Shark/Agent tiers only)

### Tier-Based Behavior

#### 1. **Strategist Tier** 
- Icon shows red border (always OFF)
- **Non-toggleable** - tapping shows subscription modal
- Modal includes:
  - Header: "Shark-mode requires a Shark subscription"
  - Subscribe button → navigates to `xavo.app/subscription`
  - Close button (✕) → closes modal
  - Hint text: "Upgrade to unlock power-play tactics."

#### 2. **Shark Tier**
- Icon is **toggleable**
- OFF → ON: Tap red icon → Green border + Toast "Shark-mode ON."
- ON → OFF: Tap green icon → Red border + Toast "Shark-mode OFF."

#### 3. **Trial Tier (Agent)**
- Same behavior as Shark tier
- Icon is **toggleable** with toasts

## 📱 Testing Scenarios

### Test 1: Strategist Tier Modal
1. Set user tier to 'strategist'
2. Tap shark icon in header
3. ✅ **Expected**: Modal appears with subscription message
4. Tap "Subscribe" button
5. ✅ **Expected**: Browser opens to `xavo.app/subscription`
6. Tap "✕" close button  
7. ✅ **Expected**: Modal closes

### Test 2: Shark Tier Toggle
1. Set user tier to 'shark'
2. Icon should show red border (OFF state)
3. Tap icon
4. ✅ **Expected**: 
   - Icon turns green border
   - Toast: "Shark-mode ON." (Android) or Alert (iOS)
5. Tap icon again
6. ✅ **Expected**: 
   - Icon turns red border  
   - Toast: "Shark-mode OFF."

### Test 3: Trial Tier Toggle
1. Set user tier to 'trial'
2. Follow same steps as Test 2
3. ✅ **Expected**: Same behavior as Shark tier

### Test 4: State Persistence
1. Enable shark-mode (green border)
2. Close and reopen app
3. ✅ **Expected**: Shark-mode state persists (still green)

### Test 5: Tier Change Reset
1. Set tier to 'shark', enable shark-mode (green)
2. Change tier to 'strategist' (via settings)
3. ✅ **Expected**: Shark-mode automatically resets to OFF (red border)

### Test 6: Multi-User Support
1. Sign in as User A, enable shark-mode
2. Sign out, sign in as User B
3. ✅ **Expected**: User B starts with shark-mode OFF
4. Sign back in as User A
5. ✅ **Expected**: User A's shark-mode state is restored

## 🔧 Technical Implementation

### Key Files Modified
- `src/components/SharkToggleIcon.tsx` - Main implementation
- `src/components/SettingsDrawer.tsx` - Updated to use AuthProvider

### State Management
- **Shark-mode state**: Stored in AsyncStorage per user (`@shark_mode_enabled_${userId}`)
- **Tier information**: Retrieved from AuthProvider
- **Persistence**: Automatically saves/loads on user login

### Platform Differences
- **Android**: Uses `ToastAndroid.show()` for notifications
- **iOS**: Uses `Alert.alert()` for notifications

## 🐛 Debugging Tips

### Check Console Logs
```
🦈 Loaded shark-mode state: true for user: abc123
🦈 Shark icon pressed, tier: strategist
💰 Opening subscription modal for strategist
🔄 Toggling shark-mode for shark tier
🦈 Saved shark-mode state: true for user: abc123
🦈 Resetting shark-mode for strategist tier
```

### Common Issues
1. **Modal not showing**: Check if tier is correctly set to 'strategist'
2. **State not persisting**: Verify user.id exists and AsyncStorage is working
3. **Wrong tier behavior**: Confirm tier mapping in AuthProvider

## ✅ Acceptance Criteria

All tests should pass to ensure the feature works correctly:

- [ ] Strategist users see subscription modal (non-toggleable)
- [ ] Shark users can toggle with toasts
- [ ] Trial users can toggle with toasts  
- [ ] State persists across app restarts
- [ ] State resets when downgrading to strategist
- [ ] Multi-user support works correctly
- [ ] Modal links to correct subscription URL
- [ ] Toasts show appropriate messages
- [ ] Visual states (red/green borders) display correctly

---

*Ready for testing! 🦈✨* 