'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';


const COLORS = {
  "v1": ["#fbeb1d", "#ffaf06", "#ff650f", "#c90805", "#03bbc5", "#04d8ae", "#0c820c", "#0ad50d", "#8713e9", "#0044a7", "#026dff", "#00beff", "#760000", "#85045a", "#ef00ba", "#ca00d2", "#000000", "#5b5b5b", "#edb995", "#713620"],
  "v2": ["#7fadb2", "#e5c0ae", "#e5dc60", "#7db159", "#2f9078", "#e5b38b", "#5a82a4", "#a5d7a9", "#ce6781", "#34a266", "#f49923", "#d1492e", "#c05a3e", "#e27e6f", "#a5c7cb", "#d1cd84", "#e19980", "#134562", "#b39ab3", "#a51d25"]
};

type ToolType = 'pencil' | 'pastel' | 'brush';

const ORIGINAL_WIDTH = 2560; // Increased from 1920
const ORIGINAL_HEIGHT = 1920; // Increased from 1440
const TARGET_HD_WIDTH = 2560;   
const TARGET_HD_HEIGHT = 1920;  
const DEFAULT_MAX_WIDTH = 2560;

// Add stroke style configurations
const STROKE_EFFECTS = {
  pencil: { opacity: 0.8, variation: 0.4 },
  pastel: { opacity: 0.6, variation: 0.2 },
  brush: { opacity: 1, variation: 0 }
} as const;

export function PaintingCanvas() {
  const [selectedColor, setSelectedColor] = useState(COLORS.v1[0]);
  const [toolType, setToolType] = useState<ToolType>('pencil');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const baseImageRef = useRef<HTMLImageElement | undefined>();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [maxDisplayWidth, setMaxDisplayWidth] = useState(DEFAULT_MAX_WIDTH);
  const lastInteractionRef = useRef<number>(Date.now());

  const [colorType, setColorType] = useState<'v1' | 'v2'>('v1');
  const [eraserEnabled, setEraserEnabled] = useState(false);

  // Initialize maxDisplayWidth and handle window resize
  useEffect(() => {
    const updateMaxWidth = () => {
      const padding = window.innerWidth < 640 ? 32 : 64; // Larger padding on bigger screens
      setMaxDisplayWidth(Math.min(DEFAULT_MAX_WIDTH, window.innerWidth - padding));
    };

    updateMaxWidth();
    window.addEventListener('resize', updateMaxWidth);
    return () => window.removeEventListener('resize', updateMaxWidth);
  }, []);

  // Calculate canvas size based on window width and aspect ratio
  useEffect(() => {
    const calculateSize = () => {
      // Calculate available height (subtract header/footer space if any)
      const availableHeight = window.innerHeight - 40; // 40px for minimal padding
      const aspectRatio = TARGET_HD_WIDTH / TARGET_HD_HEIGHT;
      
      // Start with height-based calculation
      let height = availableHeight;
      let width = height * aspectRatio;

      // If width exceeds available width, scale down
      const availableWidth = window.innerWidth - 200; // 200px for tools panel and padding
      if (width > availableWidth) {
        width = availableWidth;
        height = width / aspectRatio;
      }
      
      setCanvasSize({
        width: Math.floor(width),
        height: Math.floor(height)
      });
    };

    calculateSize();
    window.addEventListener('resize', calculateSize);
    return () => window.removeEventListener('resize', calculateSize);
  }, []);

  // Initialize canvas with base image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.width) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = TARGET_HD_WIDTH;
    canvas.height = TARGET_HD_HEIGHT;

    const img = document.createElement('img');
    img.src = '/image.png';
    baseImageRef.current = img;
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scale = Math.min(
        TARGET_HD_WIDTH / ORIGINAL_WIDTH,
        TARGET_HD_HEIGHT / ORIGINAL_HEIGHT
      );
      
      const scaledWidth = ORIGINAL_WIDTH * scale;
      const scaledHeight = ORIGINAL_HEIGHT * scale;
      const offsetX = (TARGET_HD_WIDTH - scaledWidth) / 2;
      const offsetY = (TARGET_HD_HEIGHT - scaledHeight) / 2;
      
      ctx.drawImage(
        img,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight
      );
    };
  }, [canvasSize.width]);

  // Modified flood fill to support different stroke styles
  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];

    // Check if the target pixel is black (or very close to black)
    const isBlack = startR <= 10 && startG <= 10 && startB <= 10;
    if (isBlack) return; // Don't fill if the target area is black

    // Check if the target pixel is white/background
    const isWhite = startR >= 245 && startG >= 245 && startB >= 245;
    if (eraserEnabled && isWhite) return; // Don't erase if it's white/background

    const fillRGB = hexToRgb(fillColor);
    if (!fillRGB) return;

    const effect = STROKE_EFFECTS[toolType];
    const pixelsToCheck = [[startX, startY]];
    const visited = new Set();

    while (pixelsToCheck.length > 0) {
      const [x, y] = pixelsToCheck.pop()!;
      const pos = (y * canvas.width + x) * 4;

      if (visited.has(`${x},${y}`)) continue;
      visited.add(`${x},${y}`);

      // For eraser, check if the current pixel is similar to the start pixel
      const isSimilarColor = 
        Math.abs(pixels[pos] - startR) < 30 &&
        Math.abs(pixels[pos + 1] - startG) < 30 &&
        Math.abs(pixels[pos + 2] - startB) < 30;

      if (eraserEnabled ? isSimilarColor : (
        pixels[pos] === startR &&
        pixels[pos + 1] === startG &&
        pixels[pos + 2] === startB &&
        pixels[pos + 3] === startA
      )) {
        if (eraserEnabled) {
          // Reset to white background
          pixels[pos] = 255;     // R
          pixels[pos + 1] = 255; // G
          pixels[pos + 2] = 255; // B
          pixels[pos + 3] = 255; // A
        } else {
          const variation = effect.variation * (Math.random() - 0.5);
          const opacity = effect.opacity * (1 + variation);

          pixels[pos] = Math.round(fillRGB.r * (1 + variation));
          pixels[pos + 1] = Math.round(fillRGB.g * (1 + variation));
          pixels[pos + 2] = Math.round(fillRGB.b * (1 + variation));
          pixels[pos + 3] = Math.round(255 * opacity);
        }

        if (x > 0) pixelsToCheck.push([x - 1, y]);
        if (x < canvas.width - 1) pixelsToCheck.push([x + 1, y]);
        if (y > 0) pixelsToCheck.push([x, y - 1]);
        if (y < canvas.height - 1) pixelsToCheck.push([x, y + 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.preventDefault(); // Prevent default touch behavior
    lastInteractionRef.current = Date.now();
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = Math.floor((clientX - rect.left) * (TARGET_HD_WIDTH / rect.width));
    const y = Math.floor((clientY - rect.top) * (TARGET_HD_HEIGHT / rect.height));

    floodFill(x, y, selectedColor);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(
      TARGET_HD_WIDTH / ORIGINAL_WIDTH,
      TARGET_HD_HEIGHT / ORIGINAL_HEIGHT
    );
    
    const scaledWidth = ORIGINAL_WIDTH * scale;
    const scaledHeight = ORIGINAL_HEIGHT * scale;
    const offsetX = (TARGET_HD_WIDTH - scaledWidth) / 2;
    const offsetY = (TARGET_HD_HEIGHT - scaledHeight) / 2;
    
    ctx.drawImage(
      baseImageRef.current,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );
  };

  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastInteractionRef.current >= 60000) {
        resetCanvas();
        lastInteractionRef.current = now;
      }
    };

    const intervalId = setInterval(checkInactivity, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleToolClick = () => {
    switch (toolType) {
      case 'pencil':
        setToolType('pastel');
        console.log('pastel');
        break;
      case 'pastel':
        setToolType('brush');
        console.log('brush');
        break;
      default:
        setToolType('pencil');
        console.log('pencil');
    }
  };

  const handleColorClick = () => {
    setColorType(colorType === 'v1' ? 'v2' : 'v1');
  };

  const handleEraserClick = () => {
    console.log('eraser');
    setEraserEnabled(!eraserEnabled);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] pl-4 py-4 pr-[100px] items-center gap-4 w-full h-screen">
      <div className="relative w-full h-full flex items-center">
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize.width + 'px',
            height: canvasSize.height + 'px',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
          className="border border-gray-300 rounded touch-none shadow-lg"
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />
      </div>
      <div className="w-full flex flex-col items-center">
        <div className="flex gap-3 items-center">
          <div
            onClick={() => handleToolClick()}
            className="cursor-pointer w-[80px] h-[80px]"
          >
            <Image src={`/${toolType}.png`} alt="pencil" className="w-full h-full object-contain" width={80} height={80} />
          </div>
          <div 
            onClick={()=>handleColorClick()}
            className="cursor-pointer w-[80px] h-[80px]"
          >
            <Image src="/pallete.PNG" alt="pallete" className="w-full h-full object-contain" width={80} height={80} />
          </div>
          <div
            onClick={() => handleEraserClick()}
            className={`cursor-pointer transition-all duration-200 w-[80px] h-[80px] ${
              eraserEnabled 
                ? 'scale-110 bg-gray-100 shadow-lg rounded-xl p-2 border-2 border-blue-400' 
                : 'hover:scale-105'
            }`}
          >
            <Image src="/stirka.png" alt="eraser" className="w-full h-full object-contain" width={80} height={80} />
          </div>
        </div>
        <div className="grid grid-cols-4 justify-center gap-2 mb-4 mt-2">
          {COLORS[colorType].map((color) => (
            <div key={color} className="cursor-pointer" onClick={() => setSelectedColor(color)}>
            <Image
              src={`/${toolType}_${colorType}/${color}.png`}
              alt="color"
              width={80}
              height={90}
            />
            </div>
          ))}
        </div>
        <div>
        <button
          onClick={resetCanvas}
          className="w-full flex items-center justify-center p-2 mt-4 bg-[url('/button_bg.png')] bg-cover bg-center rounded-xl"
        >
          <div className='w-[60px] h-[60px]'>
          <Image src="/restart_icon.png" alt="reset" className="w-full h-full object-contain" width={30} height={30} />
          </div>
          <div className='w-[120px] h-[50px]'>
          <Image src="/restart_text.png" alt="reset" className="w-full h-full object-contain" width={30} height={30} />
          </div>
        </button>
        </div>
      </div>
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