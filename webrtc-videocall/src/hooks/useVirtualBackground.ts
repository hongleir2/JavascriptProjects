import { useRef, useCallback, useState, useEffect } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export type BackgroundMode = 'none' | 'blur' | 'image';

export interface BackgroundOption {
  id: string;
  mode: BackgroundMode;
  label: string;
  thumbnail?: string;
  imageUrl?: string;
}

// Curated Unsplash wallpapers (direct image URLs with size params)
export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'none', mode: 'none', label: 'None' },
  { id: 'blur', mode: 'blur', label: 'Blur' },
  {
    id: 'mountain',
    mode: 'image',
    label: 'Mountain',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640&h=480&fit=crop',
  },
  {
    id: 'beach',
    mode: 'image',
    label: 'Beach',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&h=480&fit=crop',
  },
  {
    id: 'forest',
    mode: 'image',
    label: 'Forest',
    thumbnail: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=640&h=480&fit=crop',
  },
  {
    id: 'city',
    mode: 'image',
    label: 'City Night',
    thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=640&h=480&fit=crop',
  },
  {
    id: 'aurora',
    mode: 'image',
    label: 'Aurora',
    thumbnail: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=640&h=480&fit=crop',
  },
  {
    id: 'desert',
    mode: 'image',
    label: 'Desert',
    thumbnail: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=640&h=480&fit=crop',
  },
  {
    id: 'space',
    mode: 'image',
    label: 'Space',
    thumbnail: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=640&h=480&fit=crop',
  },
  {
    id: 'cafe',
    mode: 'image',
    label: 'Café',
    thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=160&h=100&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=640&h=480&fit=crop',
  },
];

interface UseVirtualBackgroundOptions {
  onLog: (source: 'pc', message: string) => void;
}

export function useVirtualBackground({ onLog }: UseVirtualBackgroundOptions) {
  const [activeOption, setActiveOption] = useState<BackgroundOption>(BACKGROUND_OPTIONS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const activeOptionRef = useRef<BackgroundOption>(BACKGROUND_OPTIONS[0]);

  // Keep ref in sync
  useEffect(() => {
    activeOptionRef.current = activeOption;
  }, [activeOption]);

  const initSegmenter = useCallback(async () => {
    if (segmenterRef.current) return segmenterRef.current;

    onLog('pc', 'loading segmentation model...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    const segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });

    segmenterRef.current = segmenter;
    onLog('pc', 'segmentation model loaded');
    return segmenter;
  }, [onLog]);

  const loadBackgroundImage = useCallback((url: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load background image: ${url}`));
      img.src = url;
    });
  }, []);

  const processFrame = useCallback((segmenter: ImageSegmenter) => {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const option = activeOptionRef.current;

    if (!video || !canvas || !ctx || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(() => processFrame(segmenter));
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    if (option.mode === 'none') {
      ctx.drawImage(video, 0, 0, w, h);
      animFrameRef.current = requestAnimationFrame(() => processFrame(segmenter));
      return;
    }

    // Run segmentation
    const result = segmenter.segmentForVideo(video, performance.now());
    const mask = result.categoryMask;

    if (!mask) {
      ctx.drawImage(video, 0, 0, w, h);
      animFrameRef.current = requestAnimationFrame(() => processFrame(segmenter));
      return;
    }

    // Draw camera frame
    ctx.drawImage(video, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    const maskData = mask.getAsUint8Array();

    if (option.mode === 'blur') {
      // Draw blurred version
      ctx.save();
      ctx.filter = 'blur(12px)';
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      const blurred = ctx.getImageData(0, 0, w, h);

      // Composite: person from original, background from blurred
      for (let i = 0; i < maskData.length; i++) {
        const isPerson = maskData[i] === 0;
        if (isPerson) {
          blurred.data[i * 4] = frame.data[i * 4];
          blurred.data[i * 4 + 1] = frame.data[i * 4 + 1];
          blurred.data[i * 4 + 2] = frame.data[i * 4 + 2];
          blurred.data[i * 4 + 3] = frame.data[i * 4 + 3];
        }
      }
      ctx.putImageData(blurred, 0, 0);
    } else if (option.mode === 'image' && bgImageRef.current) {
      // Draw background image
      ctx.drawImage(bgImageRef.current, 0, 0, w, h);
      const bgData = ctx.getImageData(0, 0, w, h);

      // Composite: person from camera, background from image
      for (let i = 0; i < maskData.length; i++) {
        const isPerson = maskData[i] === 0;
        if (isPerson) {
          bgData.data[i * 4] = frame.data[i * 4];
          bgData.data[i * 4 + 1] = frame.data[i * 4 + 1];
          bgData.data[i * 4 + 2] = frame.data[i * 4 + 2];
          bgData.data[i * 4 + 3] = frame.data[i * 4 + 3];
        }
      }
      ctx.putImageData(bgData, 0, 0);
    }

    mask.close();
    animFrameRef.current = requestAnimationFrame(() => processFrame(segmenter));
  }, []);

  const startProcessing = useCallback(async (
    localStream: MediaStream,
    pc: RTCPeerConnection | null,
  ) => {
    // Create hidden video element for source
    const video = document.createElement('video');
    video.srcObject = localStream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    videoElRef.current = video;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true })!;

    // Init segmenter
    const segmenter = await initSegmenter();

    // Start processing loop
    processFrame(segmenter);

    // Capture canvas as stream
    const canvasStream = canvas.captureStream(30);
    processedStreamRef.current = canvasStream;
    setProcessedStream(canvasStream);

    // Replace video track in PC
    if (pc) {
      const processedTrack = canvasStream.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(processedTrack);
        onLog('pc', 'replaced with virtual background track');
      }
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    onLog('pc', 'virtual background started');

    return canvasStream;
  }, [initSegmenter, processFrame, onLog]);

  const stopProcessing = useCallback(async (
    localStream: MediaStream | null,
    pc: RTCPeerConnection | null,
  ) => {
    cancelAnimationFrame(animFrameRef.current);

    if (processedStreamRef.current) {
      for (const track of processedStreamRef.current.getTracks()) {
        track.stop();
      }
      processedStreamRef.current = null;
    }

    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }

    // Restore original camera track
    if (pc && localStream) {
      const cameraTrack = localStream.getVideoTracks()[0];
      if (cameraTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(cameraTrack);
          onLog('pc', 'restored original camera track');
        }
      }
    }

    isProcessingRef.current = false;
    setIsProcessing(false);
    setProcessedStream(null);
    setActiveOption(BACKGROUND_OPTIONS[0]);
    onLog('pc', 'virtual background stopped');
  }, [onLog]);

  const applyOption = useCallback(async (
    option: BackgroundOption,
    localStream: MediaStream | null,
    pc: RTCPeerConnection | null,
  ) => {
    setActiveOption(option);
    activeOptionRef.current = option;

    if (option.mode === 'none') {
      if (isProcessingRef.current) {
        await stopProcessing(localStream, pc);
      }
      return;
    }

    // Load background image if needed
    if (option.mode === 'image' && option.imageUrl) {
      try {
        bgImageRef.current = await loadBackgroundImage(option.imageUrl);
        onLog('pc', `loaded background: ${option.label}`);
      } catch (err) {
        onLog('pc', `background image load failed: ${err instanceof Error ? err.message : 'unknown'}`);
        return;
      }
    }

    // Start processing if not already running
    if (!isProcessingRef.current && localStream) {
      await startProcessing(localStream, pc);
    }
  }, [stopProcessing, startProcessing, loadBackgroundImage, onLog]);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    processedStreamRef.current?.getTracks().forEach(t => t.stop());
    processedStreamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    segmenterRef.current?.close();
    segmenterRef.current = null;
    isProcessingRef.current = false;
    setIsProcessing(false);
    setProcessedStream(null);
    setActiveOption(BACKGROUND_OPTIONS[0]);
  }, []);

  return {
    activeOption,
    isProcessing,
    applyOption,
    stopProcessing,
    cleanup,
    processedStreamRef,
    processedStream,
  };
}
