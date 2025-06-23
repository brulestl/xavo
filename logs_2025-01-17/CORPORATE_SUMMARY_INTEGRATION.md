# Corporate Summary Integration Guide

## 🏢 **Overview**
After a user completes the 24-question quiz and onboarding, the system will automatically generate a polished corporate persona summary (≤500 characters) using OpenAI and the provided template, then persist it in the `user_personalization.quiz_summary` column.

## 📝 **Corporate Template Used**
```
[Role] in [Function] at a [Company Size]-person firm.
Communication: [communication_style]. Conflict: [conflict_approach]. Decision-making: [decision_making].
Personality scores: Assertiveness [assertiveness], Strategic [strategic], Adaptability [adaptability], Empathy [empathy], Conscientiousness [conscientiousness], Integrity [integrity].
Challenges: [top_challenges comma-list].
Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.
```

## 🏗️ **What's Been Implemented**

### **Backend (NestJS API)**
- **DTO**: `GenerateCorporateSummaryDto` with userId validation
- **Endpoint**: `POST /api/v1/profile/generate-summary`
- **Service**: `generateCorporateSummary()` method with OpenAI integration
- **OpenAI Integration**: Uses GPT-4o-mini to refine and polish the summary to ≤500 chars

### **Frontend Service**
- **File**: `src/services/corporateSummaryService.ts`
- **Function**: `generateCorporateSummary(userId: string)`
- **Fallback**: Database-driven summaries when endpoints fail

### **Supabase RPC Function**
- **File**: `sql/create_corporate_summary_function.sql`
- **Function**: `generate_corporate_summary(user_id)`
- **Template Logic**: Uses the exact corporate template with real user data

### **Quiz Integration**
- **File**: `src/screens/PersonalityQuizScreen.tsx`
- **Integration**: Automatically calls corporate summary generation after quiz completion
- **Non-blocking**: Summary generation won't interrupt the user flow if it fails

## 🚀 **Integration Steps**

### **1. Deploy the Supabase Function**
```sql
-- Run this in Supabase SQL Editor
-- (Copy content from sql/create_corporate_summary_function.sql)
```

### **2. Already Integrated in Quiz Flow**
The corporate summary generation is already integrated into the `PersonalityQuizScreen.tsx` and will automatically run after quiz completion:

```typescript
// Generate corporate summary after quiz completion
try {
  console.log('🏢 Generating corporate summary...');
  const { generateCorporateSummary } = await import('../services/corporateSummaryService');
  const summary = await generateCorporateSummary(user.id);
  console.log('✅ Corporate summary generated:', summary);
} catch (summaryError) {
  console.warn('⚠️ Warning generating corporate summary (non-critical):', summaryError);
  // Don't block the flow if summary generation fails
}
```

### **3. Display Summary (Optional)**
You can retrieve and display the summary anywhere in your app:

```typescript
// Get summary from database
const { data: personalization } = await supabase
  .from('user_personalization')
  .select('quiz_summary')
  .eq('user_id', userId)
  .single();

const corporateSummary = personalization?.quiz_summary;
```

## 📊 **Example Corporate Summaries**

The system generates polished, professional summaries based on real user data:

### **Sales Manager Example**
> "Sales Manager in Business Development at a 500-person firm. Communication: assertively and directly. Conflict: seeking win-win solutions. Decision-making: collaborative consensus. Personality scores: Assertiveness 85%, Strategic 78%, Adaptability 72%, Empathy 68%, Conscientiousness 82%, Integrity 91%. Challenges: building stakeholder trust, managing up effectively. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure."

### **Marketing Analyst Example**
> "Analyst in Digital Marketing at a 50-person firm. Communication: diplomatically and persuasively. Conflict: finding creative compromises. Decision-making: data-driven analysis. Personality scores: Assertiveness 62%, Strategic 88%, Adaptability 85%, Empathy 79%, Conscientiousness 75%, Integrity 83%. Challenges: executive communication, cross-team collaboration. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure."

### **Technical Associate Example**
> "Associate in Engineering at a 200-person firm. Communication: technically and precisely. Conflict: addressing root causes. Decision-making: systematic evaluation. Personality scores: Assertiveness 58%, Strategic 92%, Adaptability 71%, Empathy 65%, Conscientiousness 89%, Integrity 87%. Challenges: influencing without authority, technical leadership. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure."

## 🔧 **Data Sources**

The corporate summary pulls from multiple data sources:

### **From `user_personalization` table:**
- `current_position` → [Role]
- `primary_function` → [Function]
- `company_size` → [Company Size]
- `top_challenges` → [top_challenges comma-list]
- `personality_scores` → personality percentages

### **From `metadata.personalityAnswers`:**
- `communication_style` → [communication_style]
- `conflict_approach` → [conflict_approach]
- `decision_making` → [decision_making]

### **From `onboarding_answers` table:**
- Quiz responses for additional personality insights

## 🤖 **OpenAI Integration**

### **Backend Service (NestJS)**
- **Model**: GPT-4o-mini for cost-effective refinement
- **System Prompt**: Instructs AI to polish and tighten the summary to ≤500 chars
- **Temperature**: 0.7 for balanced creativity and consistency
- **Max Tokens**: 200 for concise responses

### **Fallback Strategy**
- **Primary**: OpenAI-refined summary
- **Secondary**: Template-based summary (if OpenAI fails)
- **Tertiary**: Generic professional summary (if all fails)

## 🎯 **Key Features**

✅ **Corporate Template**: Uses the exact template you provided  
✅ **OpenAI Refinement**: AI polishes the summary for professional tone  
✅ **Real Data**: Interpolates actual user responses and scores  
✅ **≤500 Characters**: Enforced at multiple levels  
✅ **Smart Fallbacks**: Multiple levels of error handling  
✅ **Database Persistence**: Auto-saved in `user_personalization.quiz_summary`  
✅ **Non-blocking**: Won't interrupt user flow if generation fails  
✅ **Comprehensive Logging**: Full debugging information  

## 🔧 **Configuration**

### **For Expo App (Current Setup)**
- Uses Supabase RPC function `generate_corporate_summary`
- Automatically handles authentication via JWT
- Falls back to database-driven summaries

### **For Deployed Backend (Future)**
- Uncomment the NestJS endpoint in `corporateSummaryService.ts`
- Deploy the API and update the URL
- Provides OpenAI integration with more control

## 🧪 **Testing**

1. **Complete the quiz flow** with a test user
2. **Check the logs** for corporate summary generation messages
3. **Verify in Supabase** that `quiz_summary` column is populated
4. **Test different user profiles** (different roles, functions, personality answers)

## 📋 **SQL Query to Check Results**

```sql
-- Check the generated corporate summary
SELECT 
  user_id,
  current_position,
  primary_function,
  quiz_summary,
  LENGTH(quiz_summary) as summary_length,
  updated_at
FROM user_personalization 
WHERE user_id = 'your-user-id-here';
```

## 🚀 **Deployment Checklist**

- ✅ **Backend API**: Corporate summary endpoint implemented
- ✅ **Frontend Service**: Corporate summary service created
- ✅ **Quiz Integration**: Automatic generation after quiz completion
- ⏳ **Supabase Function**: Deploy `sql/create_corporate_summary_function.sql`
- ⏳ **Testing**: Verify end-to-end functionality

The system will automatically generate polished, professional corporate summaries that capture the user's complete professional persona in under 500 characters! 🏢✨ 