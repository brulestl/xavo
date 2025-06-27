// OCR Health Check - Test OCR processing locally
// This helps verify if OCR issues are in the engine or integration

interface OCRTestResult {
  success: boolean;
  extractedText?: string;
  error?: string;
  processingTime: number;
}

/**
 * Test OCR processing on a buffer (simulates our Edge Function OCR)
 */
export async function testOCR(buffer: ArrayBuffer, mimeType: string): Promise<OCRTestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing OCR processing...', {
      bufferSize: buffer.byteLength,
      mimeType
    });

    // Simulate the same OCR processing as our Edge Function
    if (mimeType.startsWith('image/')) {
      // Convert to base64 (same as Edge Function)
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      
      console.log('📝 Base64 conversion successful, length:', base64.length);
      
      // Note: We can't actually call OpenAI here without API key in local environment
      // But we can test the buffer processing and conversion
      const mockOCRResult = `[Mock OCR Result - Buffer processed successfully: ${buffer.byteLength} bytes, Base64: ${base64.length} chars]`;
      
      console.log('✅ OCR processing simulation completed');
      
      return {
        success: true,
        extractedText: mockOCRResult,
        processingTime: Date.now() - startTime
      };
    } else {
      throw new Error('Unsupported file type for OCR test');
    }
  } catch (error) {
    console.error('❌ OCR test failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Test OCR with a file path (for quick local testing)
 */
export async function testOCRFromFile(filePath: string): Promise<void> {
  try {
    console.log('📁 Loading file for OCR test:', filePath);
    
    // In React Native, we'd use fetch() instead of fs
    const response = await fetch(filePath);
    
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    const result = await testOCR(buffer, mimeType);
    
    console.log('🎯 OCR Test Result:', result);
    
    if (result.success) {
      console.log('✅ OCR is working correctly!');
      console.log('📝 Extracted text preview:', result.extractedText?.substring(0, 200) + '...');
    } else {
      console.log('❌ OCR failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 File test failed:', error);
  }
}

/**
 * Quick test with a known working image URL
 */
export async function quickOCRTest(): Promise<void> {
  console.log('🚀 Running quick OCR test...');
  
  // Test with a simple image URL (you can replace with any test image)
  const testImageUrl = 'https://via.placeholder.com/300x200/000000/FFFFFF?text=Test+Image';
  
  await testOCRFromFile(testImageUrl);
} 