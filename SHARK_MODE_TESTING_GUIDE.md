# 🦈 Shark Mode Testing Guide

## 🚀 How to Test the Implementation

### 1. **Start the Development Server**
```bash
npm start
# or
expo start
```

### 2. **Visual Verification**
- [ ] **Header Icons**: Verify shark icon appears next to gear icon in both Home and Chat screens
- [ ] **Theme Switching**: Toggle dark/light mode - shark icon should change:
  - Light mode: Black shark icon
  - Dark mode: Platinum shark icon
- [ ] **Icon Size**: Both icons should be same size (24x24) and aligned properly

### 3. **Functional Testing**

#### Basic Toggle
- [ ] Tap shark icon - should toggle between Shark ↔ Strategist mode
- [ ] When Shark active: "ON" badge appears below icon in green
- [ ] When Strategist active: No badge visible
- [ ] Toggle should work instantly (optimistic updates)

#### Persistence Testing
- [ ] Toggle to Shark mode
- [ ] Close and reopen app - should remember Shark mode
- [ ] Check Supabase `user_profiles` table - `tier` should be 'shark'
- [ ] Toggle to Strategist - database should update to 'strategist'

### 4. **Chat Behavior Testing**

#### Shark Mode Chat
- [ ] Set tier to 'shark'
- [ ] Send a message about "office politics" or "difficult colleague"
- [ ] AI response should be:
  - Aggressive and direct
  - No sugar-coating
  - Tactical political advice
  - End with "Power Play:" section

#### Strategist Mode Chat
- [ ] Set tier to 'strategist'  
- [ ] Send same message
- [ ] AI response should be:
  - Professional and thoughtful
  - Strategic but balanced
  - No "Power Play:" endings

### 5. **Edge Cases**

#### Network Issues
- [ ] Turn off internet
- [ ] Try to toggle tier - should show optimistic update
- [ ] Turn on internet - should sync to Supabase

#### Authentication States
- [ ] Test with logged-out user (should default to strategist)
- [ ] Test with newly registered user (should load tier from database)

### 6. **Cross-Platform Testing**
- [ ] iOS: Test on simulator/device
- [ ] Android: Test on emulator/device
- [ ] Verify icons render correctly on both platforms
- [ ] Verify touch targets work properly

## 🔧 Debugging Tools

### Check Current Tier
In React DevTools or via console:
```javascript
// Check current tier state
console.log('Current tier:', tier);
```

### Database Verification
Query Supabase directly:
```sql
SELECT user_id, tier, updated_at 
FROM user_profiles 
WHERE user_id = 'your-user-id';
```

### Console Logs to Watch
- `✅ Tier updated to shark for user {id}`
- `🦈 Shark mode activated`
- `🎯 Strategist mode activated`

## 🐛 Known Issues & Solutions

### Icon Not Appearing
- Verify logo files exist in `media/logo/`
- Check import paths in SharkToggleIcon component

### Toggle Not Persisting
- Check Supabase connection
- Verify `user_profiles` table exists with `tier` column
- Check user authentication status

### Theme Icons Not Switching
- Verify `useTheme()` hook is working
- Check `isDark` state in component

## 🎯 Success Criteria

### ✅ Visual
- Shark icon visible in both Home + Chat headers
- Icons swap correctly with theme changes
- "ON" badge appears/disappears appropriately
- Header layout remains consistent

### ✅ Functional  
- One-tap toggle works instantly
- Tier persists across app restarts
- Supabase updates successfully
- No UI lag or glitches

### ✅ Chat Behavior
- Shark mode uses aggressive prompt
- Strategist mode uses professional prompt
- Model selection works correctly
- Context maintains across conversation

## 🚨 Emergency Rollback

If issues arise, disable feature by:

1. **Quick Fix**: Comment out SharkToggleIcon in headers
```tsx
{/* <SharkToggleIcon /> */}
```

2. **Full Rollback**: Remove TierProvider from App.tsx
```tsx
// <TierProvider>
<NavigationContainer>
  <AppNavigator />
</NavigationContainer>
// </TierProvider>
```

The implementation is ready for production testing! 🦈✨ 