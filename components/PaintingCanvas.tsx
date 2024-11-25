'use client';

import { useEffect, useRef, useState } from 'react';

const COLORS = [
  '#FF0000', // Red
  '#FF9900', // Orange
  '#FFFF00', // Yellow
  '#33CC33', // Green
  '#3366FF', // Blue
  '#9933FF', // Purple
  '#FF99CC', // Pink
  '#996633', // Brown
  '#000000', // Black
  '#FFFFFF', // White
];

const STROKE_STYLES = ['solid', 'pastel', 'pencil'] as const;
type StrokeStyle = typeof STROKE_STYLES[number];

const ORIGINAL_WIDTH = 1307;
const ORIGINAL_HEIGHT = 1030;
const TARGET_HD_WIDTH = 1307;   // Reduced from 1280
const TARGET_HD_HEIGHT = 1030;  // Reduced from 720 (maintaining aspect ratio)
const DEFAULT_MAX_WIDTH = 1307; // Reduced from 1280


export function PaintingCanvas() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedStyle, setSelectedStyle] = useState<StrokeStyle>('solid');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const baseImageRef = useRef<HTMLImageElement | undefined>();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [maxDisplayWidth, setMaxDisplayWidth] = useState(DEFAULT_MAX_WIDTH);

  // Initialize maxDisplayWidth after component mounts
  useEffect(() => {
    setMaxDisplayWidth(Math.min(DEFAULT_MAX_WIDTH, window.innerWidth - 32));
  }, []);

  // Calculate canvas size based on window width and HD aspect ratio
  useEffect(() => {
    const calculateSize = () => {
      const containerWidth = Math.min(window.innerWidth - 32, maxDisplayWidth);
      
      // Calculate scaling to maintain HD aspect ratio (16:9)
      const hdAspectRatio = TARGET_HD_WIDTH / TARGET_HD_HEIGHT;
      const containerHeight = containerWidth / hdAspectRatio;
      
      
      setCanvasSize({
        width: Math.floor(containerWidth),
        height: Math.floor(containerHeight)
      });
    };

    calculateSize();
    window.addEventListener('resize', calculateSize);
    return () => window.removeEventListener('resize', calculateSize);
  }, [maxDisplayWidth]);

  // Initialize canvas with base image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.width) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal canvas size to HD dimensions
    canvas.width = TARGET_HD_WIDTH;
    canvas.height = TARGET_HD_HEIGHT;

    // Load base image
    const img = document.createElement('img');
    img.src = '/image.png';
    baseImageRef.current = img;
    
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate scaling to fit image properly in HD format
      const scale = Math.min(
        TARGET_HD_WIDTH / ORIGINAL_WIDTH,
        TARGET_HD_HEIGHT / ORIGINAL_HEIGHT
      );
      
      // Calculate centered position
      const scaledWidth = ORIGINAL_WIDTH * scale;
      const scaledHeight = ORIGINAL_HEIGHT * scale;
      const offsetX = (TARGET_HD_WIDTH - scaledWidth) / 2;
      const offsetY = (TARGET_HD_HEIGHT - scaledHeight) / 2;
      
      // Draw image centered and scaled
      ctx.drawImage(
        img,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight
      );
    };
  }, [canvasSize.width]);

  // Flood fill implementation
  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Get the color we're filling
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];

    // Convert fill color from hex to RGB
    const fillRGB = hexToRgb(fillColor);
    if (!fillRGB) return;

    // Queue for flood fill
    const pixelsToCheck = [[startX, startY]];
    const visited = new Set();

    while (pixelsToCheck.length > 0) {
      const [x, y] = pixelsToCheck.pop()!;
      const pos = (y * canvas.width + x) * 4;

      if (visited.has(`${x},${y}`)) continue;
      visited.add(`${x},${y}`);

      // Check if this pixel matches the start color
      if (
        pixels[pos] === startR &&
        pixels[pos + 1] === startG &&
        pixels[pos + 2] === startB &&
        pixels[pos + 3] === startA
      ) {
        // Fill this pixel
        pixels[pos] = fillRGB.r;
        pixels[pos + 1] = fillRGB.g;
        pixels[pos + 2] = fillRGB.b;
        pixels[pos + 3] = 255;

        // Add adjacent pixels to check
        if (x > 0) pixelsToCheck.push([x - 1, y]);
        if (x < canvas.width - 1) pixelsToCheck.push([x + 1, y]);
        if (y > 0) pixelsToCheck.push([x, y - 1]);
        if (y < canvas.height - 1) pixelsToCheck.push([x, y + 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Update handleCanvasClick to account for HD scaling
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Convert display coordinates to HD coordinates
    const x = Math.floor((clientX - rect.left) * (TARGET_HD_WIDTH / rect.width));
    const y = Math.floor((clientY - rect.top) * (TARGET_HD_HEIGHT / rect.height));

    floodFill(x, y, selectedColor);
  };

  // Update resetCanvas to maintain HD scaling
  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scaling to fit image properly in HD format
    const scale = Math.min(
      TARGET_HD_WIDTH / ORIGINAL_WIDTH,
      TARGET_HD_HEIGHT / ORIGINAL_HEIGHT
    );
    
    // Calculate centered position
    const scaledWidth = ORIGINAL_WIDTH * scale;
    const scaledHeight = ORIGINAL_HEIGHT * scale;
    const offsetX = (TARGET_HD_WIDTH - scaledWidth) / 2;
    const offsetY = (TARGET_HD_HEIGHT - scaledHeight) / 2;
    
    // Draw image centered and scaled
    ctx.drawImage(
      baseImageRef.current,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );
  };

  // Handle inactivity
  useEffect(() => {
    const resetTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(resetCanvas, 60000); // 1 minute
    };

    window.addEventListener('mousedown', resetTimeout);
    window.addEventListener('touchstart', resetTimeout);
    resetTimeout();

    return () => {
      window.removeEventListener('mousedown', resetTimeout);
      window.removeEventListener('touchstart', resetTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[1200px] mx-auto">
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {COLORS.map((color) => (
          <button
            key={color}
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${
              selectedColor === color ? 'border-gray-800' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {STROKE_STYLES.map((style) => (
          <button
            key={style}
            className={`px-3 py-1 sm:px-4 sm:py-2 rounded text-sm sm:text-base ${
              selectedStyle === style
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200'
            }`}
            onClick={() => setSelectedStyle(style)}
          >
            {style}
          </button>
        ))}
      </div>

      <div className="relative w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize.width + 'px',
            height: canvasSize.height + 'px'
          }}
          className="border border-gray-300 rounded touch-none mx-auto"
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />
      </div>

      <button
        onClick={resetCanvas}
        className="mt-4 px-4 py-2 sm:px-6 sm:py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm sm:text-base"
      >
        Reset
      </button>
    </div>
  );
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
} 