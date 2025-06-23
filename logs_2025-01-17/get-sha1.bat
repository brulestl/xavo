@echo off
echo Extracting SHA-1 fingerprint from debug keystore...
echo.

REM Try different possible locations for keytool
set KEYTOOL_PATHS="%JAVA_HOME%\bin\keytool.exe" "C:\Program Files\Java\jdk*\bin\keytool.exe" "C:\Program Files\OpenJDK\*\bin\keytool.exe" "C:\Program Files (x86)\Java\jdk*\bin\keytool.exe"

for %%i in (%KEYTOOL_PATHS%) do (
    if exist %%i (
        echo Found keytool at: %%i
        %%i -keystore android\app\debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
        goto :end
    )
)

echo Keytool not found. Please install Java JDK or try manual approach.
echo.
echo Alternative methods:
echo 1. Install Java JDK from https://adoptium.net/
echo 2. Or use Android Studio's built-in keytool
echo 3. Or use online SHA-1 extractor tools
echo.
echo Manual command once Java is installed:
echo keytool -keystore android\app\debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android

:end
pause 