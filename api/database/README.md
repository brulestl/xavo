# Database Setup Guide

This directory contains the SQL schema files for the Corporate Influence Coach application.

## Files Overview

1. **supabase-schema.sql** - Core conversation and messaging tables
2. **user-personalization-schema.sql** - User personalization and onboarding tables
3. **seed-personality-questions.sql** - Personality quiz questions data

## Setup Instructions

Run these SQL files in your Supabase database in the following order:

### 1. Core Schema
```sql
-- Run first: Core conversation tables
\i supabase-schema.sql
```

### 2. User Personalization Schema
```sql
-- Run second: User personalization tables and functions
\i user-personalization-schema.sql
```

### 3. Seed Data
```sql
-- Run third: Personality quiz questions
\i seed-personality-questions.sql
```

## Key Tables

- **user_personalization** - Stores user profile data and personality scores
- **onboarding_answers** - Stores user responses to onboarding questions
- **onboarding_questions** - Static personality quiz questions
- **conversation_sessions** - Chat sessions
- **conversation_messages** - Individual messages with vector embeddings

## Key Functions

- **fn_insert_or_update_personalization()** - Upserts user personalization data
- **fn_calculate_personality_scores()** - Calculates personality trait scores from quiz answers
- **search_similar_messages()** - Vector similarity search for RAG

## Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data
- Vector embeddings are stored for semantic search capabilities
- Personality scores are calculated automatically from quiz responses 