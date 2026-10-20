export type PaletteId = 'temperat' | 'snow' | 'interior' | 'universal';

export type OutputEncoding = 'cncnet_lzo_24bit' | 'lcw_8bit' | 'lcw_16bit' | 'raw_8bit';

export type PreviewDimension = 64 | 96 | 128 | 192 | 256 | 512 | 'custom' | 'native';

export interface ConversionOptions {
  width: number;
  height: number;
  palette: PaletteId;
  encoding: OutputEncoding;
  dithering: boolean;
  lineLength: number; // usually 70
  includePreviewSection: boolean;
  compressionOptimization: 'balanced' | 'fast' | 'max';
  maintainAspectRatio: boolean;
}

export interface ConversionResult {
  previewSection: string;
  previewPackSection: string;
  fullIniText: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  rawByteCount: number;
  compressedByteCount: number;
  lineCount: number;
  compressionRatio: number;
  quantizedImageData: ImageData;
  paletteColors: [number, number, number][];
  encodingName: string;
}

export interface DecodedPreview {
  width: number;
  height: number;
  imageData: ImageData;
  encodingDetected: string;
  lineCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
}
