/**
 * Thumbnail generation utilities for file attachments
 */

interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Generate a 128×128 WebP thumbnail URL for images
 */
export const generateThumbnailUrl = (
  originalUrl: string, 
  options: ThumbnailOptions = {}
): string => {
  const {
    width = 64,
    height = 64,
    quality = 85,
    format = 'webp'
  } = options;

  // If it's a Supabase storage URL, use transform parameters
  if (originalUrl.includes('supabase')) {
    const url = new URL(originalUrl);
    url.searchParams.set('width', width.toString());
    url.searchParams.set('height', height.toString());
    url.searchParams.set('quality', quality.toString());
    url.searchParams.set('format', format);
    url.searchParams.set('resize', 'cover');
    return url.toString();
  }

  // For other URLs, use a resize service or return original
  // You can integrate with services like Cloudinary, ImageKit, etc.
  return originalUrl;
};

/**
 * Get appropriate icon for file type when thumbnail generation isn't possible
 */
export const getFileTypeIcon = (fileType: string): string => {
  if (fileType.startsWith('image/')) return 'image-outline';
  if (fileType === 'application/pdf') return 'document-text-outline';
  if (fileType.includes('word') || fileType.includes('document')) return 'document-outline';
  if (fileType.startsWith('text/')) return 'document-text-outline';
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'grid-outline';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return 'easel-outline';
  return 'attach-outline';
};

/**
 * Check if file type supports thumbnail generation
 */
export const supportsThumbnail = (fileType: string): boolean => {
  return fileType.startsWith('image/');
};

/**
 * Get file type color for UI consistency
 */
export const getFileTypeColor = (fileType: string): string => {
  if (fileType.startsWith('image/')) return '#4CAF50';
  if (fileType === 'application/pdf') return '#F44336';
  if (fileType.includes('word') || fileType.includes('document')) return '#2196F3';
  if (fileType.startsWith('text/')) return '#9E9E9E';
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '#4CAF50';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '#FF9800';
  return '#757575';
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 