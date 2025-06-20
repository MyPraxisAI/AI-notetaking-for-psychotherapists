"use client";

import { useEffect, useRef, useState } from "react";

// Simple browser logger
const logger = {
  debug: (message: string, data?: any) => {
    console.debug(`[AudioVisualizer] ${message}`, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[AudioVisualizer] ${message}`, data);
  },
  error: (message: string, data?: any) => {
    console.error(`[AudioVisualizer] ${message}`, data);
  }
};

interface MyPraxisAudioVisualizerProps {
  stream: MediaStream | null;
  className?: string;
}

// Ellipse base data from the logo SVG
const ELLIPSES = [
  { cx: 192.406, cy: 209.373, rx: 12.4837, ry: 74.9025 },
  { cx: 222.367, cy: 209.374, rx: 12.4837, ry: 63.6671 },
  { cx: 162.445, cy: 209.374, rx: 12.4837, ry: 63.6671 },
  { cx: 251.404, cy: 209.373, rx: 11.5601, ry: 31.2094 },
  { cx: 132.484, cy: 262.429, rx: 12.4837, ry: 84.2653 },
];

// Calculate bounding box for ellipses
const minX = Math.min(...ELLIPSES.map(e => e.cx - e.rx));
const maxX = Math.max(...ELLIPSES.map(e => e.cx + e.rx));
const minY = Math.min(...ELLIPSES.map(e => e.cy - e.ry));
const maxY = Math.max(...ELLIPSES.map(e => e.cy + e.ry));
const logoWidth = maxX - minX;
const logoHeight = maxY - minY;
const svgWidth = 1200;
const svgHeight = 420;
const offsetX = (svgWidth - logoWidth) / 2 - minX;
const offsetY = (svgHeight - logoHeight) / 2 - minY;

export function MyPraxisAudioVisualizer({ stream, className = "" }: MyPraxisAudioVisualizerProps) {
  const [amplitude, setAmplitude] = useState(1);
  const [hasActivity, setHasActivity] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastActivityRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (audioContextRef.current) {
      logger.debug('Cleaning up previous audio context', {
        state: audioContextRef.current.state
      });
      
      if (audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch (error) {
          logger.error('Error closing audio context', { error });
        }
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (!stream) {
      logger.debug('No stream provided, resetting visualizer state');
      setAmplitude(1);
      setHasActivity(false);
      return;
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyserRef.current = analyser;
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      if (!analyserRef.current) {
        logger.warn('Analyzer not available during animation frame');
        return;
      }
      
      analyserRef.current.getByteFrequencyData(dataArray);
      // Calculate average volume (amplitude)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] || 0;
      }
      const avg = dataArray.length > 0 ? sum / dataArray.length : 0;
      // Map 0-255 to 0-1 (0 = no sound, 1 = max sound)
      const amp = avg < 5 ? 0 : Math.min(avg / 255, 1);
      
      const newHasActivity = amp > 0.02;
      
      // Log state changes to track animation triggers
      if (newHasActivity !== lastActivityRef.current) {
        logger.debug('Activity state changed', {
          hasActivity: newHasActivity,
          amplitude: amp,
          average: avg
        });
        lastActivityRef.current = newHasActivity;
      }
      
      setAmplitude(amp);
      setHasActivity(newHasActivity);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current?.state !== "closed") {
        try {
          audioContextRef.current?.close();
        } catch (error) {
          logger.error('Error closing audio context during cleanup', { error });
        }
      }
    };
  }, [stream]);

  // Force a reflow of the SVG when the stream changes
  useEffect(() => {
    if (svgRef.current) {
      // Force a reflow
      svgRef.current.style.display = 'none';
      void svgRef.current.offsetHeight;
      svgRef.current.style.display = 'block';
    }
  }, [stream]);

  return (
    <div className={`flex items-center justify-center w-full h-full ${className}`} style={{ minHeight: 126 }}>
      <svg
        ref={svgRef}
        width={"360px"}
        height={"126px"}
        viewBox="0 0 1200 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          display: "block",
          backfaceVisibility: "hidden",
          perspective: "1000px",
          transform: "translate3d(0,0,0)"
        }}
      >
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {ELLIPSES.map((ellipse, i) => {
            // phaseOffset spreads the wave left to right
            const phaseOffset = i * 0.6;
            // If no activity, show static logo
            let scale = 1;
            if (hasActivity) {
              scale = 1 + amplitude * 2.5 * Math.max(0, Math.sin(performance.now() / 180 + phaseOffset));
            }
            return (
              <ellipse
                key={i}
                cx={ellipse.cx}
                cy={ellipse.cy}
                rx={ellipse.rx}
                ry={ellipse.ry}
                fill="black"
                style={{
                  transform: `translate3d(0,0,0) scaleY(${scale})`,
                  transformOrigin: `${ellipse.cx}px ${ellipse.cy}px`,
                  backfaceVisibility: "hidden",
                  perspective: "1000px",
                  willChange: "transform",
                  transition: "none",
                  opacity: 0.95,
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
} 