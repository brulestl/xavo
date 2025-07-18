import 'dotenv/config';

export default ({ config }) => ({
  expo: {
    name: "Xavo",
    slug: "influence",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "xavo",
    updates: {
      enabled: false
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.xavo.app",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLName: "xavo-auth",
            CFBundleURLSchemes: [
              "xavo"
            ]
          }
        ],
        NSMicrophoneUsageDescription: "Xavo uses your microphone to record voice messages for AI coaching conversations.",
        NSCameraUsageDescription: "Xavo uses your camera to capture photos for sharing context with your AI coach."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.xavo.app",
      versionCode: 1,
      permissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA"
      ],
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "xavo"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ],
      manifest: {
        application: {},
        activity: [
          {
            "android:name": ".MainActivity",
            "android:windowSoftInputMode": "adjustResize"
          }
        ]
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    description: "AI-powered coaching app",
    plugins: [
      "expo-dev-client",
      "expo-secure-store",
      "expo-web-browser",
      "expo-document-picker",
      "expo-camera",
      "expo-image-picker",
      [
        "expo-build-properties",
        {
          android: {
            extraMavenRepos: ["https://artifacts.revenuecat.com/android"],
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 23,
            buildToolsVersion: "34.0.0",
            enableProguardInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false
          },
          ios: {
            deploymentTarget: "15.1"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "4e9c25f4-7c66-43b2-8788-082e84fd5d8d"
      },
      supabaseUrl: "https://wdhmlynmbrhunizbdhdt.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaG1seW5tYnJodW5pemJkaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQ2NjgsImV4cCI6MjA2NDg4MDY2OH0.ORKN6Ryiz4Yo_BFhE_CS2yHMGPJDncKtYWKTwwI98N4",
      amplitudeApiKey: "YOUR_AMPLITUDE_API_KEY_HERE",
      sentryDsn: "YOUR_SENTRY_DSN_HERE",
      openaiApiKey: process.env.OPENAI_API_KEY,
      apiUrl: {
        development: {
          web: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          android: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          ios: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          device: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1"
        },
        production: {
          web: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          android: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          ios: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1",
          device: "https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1"
        }
      }
    },
    owner: "brulestl"
  }
}); 