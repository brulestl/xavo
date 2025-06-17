# Environment Setup Guide

## Required .env File

Create a file named `.env` in the `api/` directory with the following content:

```bash
# Supabase Configuration
SUPABASE_URL=https://wdhmlynmbrhunizbdhdt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI Configuration  
OPENAI_API_KEY=your-openai-api-key-here

# Server Configuration
NODE_ENV=development
PORT=3000
```

## How to Get Your Keys

### Supabase Service Role Key
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** > **API**
4. Copy the **service_role** key (the secret one, not the anon key)
5. Paste it as the value for `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Warning**: The service role key has admin privileges. Keep it secure and never commit it to version control!

### OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Copy the key and paste it as the value for `OPENAI_API_KEY`

## Troubleshooting

### "Invalid API key" Error
This usually means:
- You're using the anon key instead of the service role key
- The service role key is incorrect or expired
- The .env file is not in the right location (should be `api/.env`)

### Environment Variables Not Loading
- Make sure the .env file is named exactly `.env` (no extension)
- Restart your server after creating/updating the .env file
- Check that there are no spaces around the `=` signs in your .env file 