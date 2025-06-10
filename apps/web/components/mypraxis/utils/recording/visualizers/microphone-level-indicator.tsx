'use client';

import { useEffect, useRef, useState } from 'react';

interface MicrophoneLevelIndicatorProps {
  stream: MediaStream | null;
  className?: string;
}

export function MicrophoneLevelIndicator({ stream, className = '' }: MicrophoneLevelIndicatorProps) {
  const [level, setLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    // Clean up previous audio context and analyzer
    if (audioContextRef.current) {
      // Check if the context isn't already closed before trying to close it
      if (audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error('Error closing AudioContext:', e);
        }
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    
    if (!stream) {
      setLevel(0);
      return;
    }
    
    // Create audio context and analyzer
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyserRef.current = analyser;
    analyser.fftSize = 256;
    
    // Connect the microphone stream to the analyzer
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Function to analyze audio and update level
    const analyzeAudio = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate the average volume level (0-255)
      let sum = 0;
      const length = dataArray?.length || 0;
      for (let i = 0; i < length; i++) {
        sum += dataArray[i] || 0;
      }
      const average = length > 0 ? sum / length : 0;
      
      // Normalize to 0-100 and apply some amplification for better visualization
      const normalizedLevel = Math.min(100, Math.max(0, average * 0.7));
      setLevel(normalizedLevel);
      
      // Schedule the next frame
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };
    
    // Start the analysis
    analyzeAudio();
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error('Error closing AudioContext in cleanup:', e);
        }
      }
    };
  }, [stream]);
  
  return (
    <div className={`h-8 bg-green-100 rounded-md overflow-hidden ${className}`}>
      <div 
        className="h-full bg-green-500 rounded-l-md transition-all duration-100 ease-in-out"
        style={{ width: `${level}%` }}
      />
    </div>
  );
}
