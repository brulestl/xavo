import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Get OpenAI API key from environment variables only
const getOpenAIApiKey = (): string | null => {
  try {
    return process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
  } catch (error) {
    console.warn('⚠️ Unable to get OpenAI API key:', error);
    return null;
  }
};

export interface VoiceRecordingProgress {
  isRecording: boolean;
  duration: number; // in seconds
  isTranscribing: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

export class VoiceTranscriptionService {
  private recording: Audio.Recording | null = null;
  private isInitialized = false;
  private openaiApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = getOpenAIApiKey();
    if (!this.openaiApiKey) {
      console.warn('📢 Voice transcription disabled - no OpenAI API key configured');
    }
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request audio recording permissions
      console.log('🎙️ Requesting audio recording permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ Audio recording permission denied');
        return false;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      this.isInitialized = true;
      console.log('✅ Voice recording initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize voice recording:', error);
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    try {
      console.log('🎙️ Starting voice recording...');
      
      // Stop any existing recording
      if (this.recording) {
        await this.stopRecording();
      }

      // Create new recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await this.recording.startAsync();
      
      console.log('✅ Voice recording started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.recording = null;
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) {
      console.warn('⚠️ No active recording to stop');
      return null;
    }

    try {
      console.log('🛑 Stopping voice recording...');
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      
      if (uri) {
        console.log('✅ Recording stopped, file saved to:', uri);
        return uri;
      } else {
        console.error('❌ No recording URI available');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.recording = null;
      return null;
    }
  }

  async cancelRecording(): Promise<void> {
    if (!this.recording) {
      return;
    }

    try {
      console.log('❌ Canceling voice recording...');
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
      console.log('✅ Recording canceled');
    } catch (error) {
      console.error('❌ Failed to cancel recording:', error);
      this.recording = null;
    }
  }

  async getRecordingStatus(): Promise<any | null> {
    if (!this.recording) {
      return null;
    }

    try {
      return await this.recording.getStatusAsync();
    } catch (error) {
      console.error('❌ Failed to get recording status:', error);
      return null;
    }
  }

  async transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    try {
      console.log('🔊 Starting audio transcription...');

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(audioUri, { size: true });
      if (!fileInfo.exists) {
        return {
          success: false,
          error: 'Audio file not found',
        };
      }

      console.log(`📁 Audio file size: ${fileInfo.size} bytes`);

      // Check file size (Whisper has a 25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (fileInfo.size && fileInfo.size > maxSize) {
        return {
          success: false,
          error: 'Audio file too large (max 25MB)',
        };
      }

      // Create FormData for Whisper API
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // Can be made configurable
      formData.append('response_format', 'json');

      console.log('📡 Calling OpenAI Whisper API...');
      
      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whisper API error:', response.status, errorText);
        return {
          success: false,
          error: `Transcription failed: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('✅ Transcription completed');

      if (result.text && result.text.trim()) {
        return {
          success: true,
          text: result.text.trim(),
        };
      } else {
        return {
          success: false,
          error: 'No speech detected in audio',
        };
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transcription error',
      };
    }
  }

  isRecording(): boolean {
    return this.recording !== null;
  }

  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.recording) {
      await this.cancelRecording();
    }
  }
}

// Create singleton instance
export const voiceTranscriptionService = new VoiceTranscriptionService(); 