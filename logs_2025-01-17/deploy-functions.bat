@echo off
echo 🚀 Deploying Supabase Edge Functions...
echo.

echo 📋 Checking Supabase CLI...
supabase --version
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI not found!
    echo Please install: npm install -g supabase
    pause
    exit /b 1
)

echo.
echo 🔗 Linking to project...
supabase link --project-ref wdhmlynmbrhunizbdhdt

echo.
echo 🔧 Deploying chat function...
supabase functions deploy chat
if %errorlevel% neq 0 (
    echo ❌ Chat function deployment failed!
    pause
    exit /b 1
)

echo.
echo 🔧 Deploying sessions function...
supabase functions deploy sessions
if %errorlevel% neq 0 (
    echo ❌ Sessions function deployment failed!
    pause
    exit /b 1
)

echo.
echo ✅ All functions deployed successfully!
echo.
echo 📡 Your API is now live at:
echo https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/
echo.
echo 🔑 Don't forget to set your OpenAI API key:
echo supabase secrets set OPENAI_API_KEY=sk-your-openai-key
echo.
echo 🧪 Test your deployment:
echo supabase functions logs --follow
echo.
pause 