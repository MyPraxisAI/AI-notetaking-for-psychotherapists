/**
 * Microphone selection utilities for the recording modal
 * This file contains functions for detecting and managing microphone devices
 */
import i18next from "i18next";

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault?: boolean;
}

/**
 * Get all available microphone devices
 * @returns Promise resolving to an array of microphone devices
 */
export const getAvailableMicrophones = async (): Promise<MicrophoneDevice[]> => {
  try {
    // Request permission if not already granted
    // This will trigger the permission prompt if needed
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Get all devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Filter for audio input devices
    const microphones = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || i18next.t('mypraxis:recordingModal.microphone.unnamed', { id: device.deviceId.substr(0, 8) }),
        groupId: device.groupId,
        isDefault: device.deviceId === 'default'
      }));
    
    // If we have no labeled devices, it likely means we don't have permission
    if (microphones.length === 0) {
      throw new Error('MICROPHONE_ACCESS_FAILED');
    }
    
    // More aggressive duplicate detection based on label similarity
    const seenLabels = new Map<string, MicrophoneDevice>();
    const uniqueByLabel: MicrophoneDevice[] = [];
    
    // First pass - ensure default device is always included but clean up its label
    const defaultDevice = microphones.find(mic => mic.isDefault);
    if (defaultDevice) {
      // Clean up the default device label by removing "Default - " prefix
      const cleanedDefaultDevice = {
        ...defaultDevice,
        label: defaultDevice.label.replace(/^Default -\s*/, '')
      };
      
      uniqueByLabel.push(cleanedDefaultDevice);
      seenLabels.set(cleanedDefaultDevice.label, cleanedDefaultDevice);
    }
    
    // Second pass - add non-default devices with unique labels
    for (const mic of microphones) {
      // Skip the default device as we've already added it
      if (mic.isDefault) continue;
      
      // Skip devices that appear to be the same as the default (same label or containing the same device name)
      if (defaultDevice && (
          mic.label === defaultDevice.label || 
          (mic.label.includes(defaultDevice.label.replace('Default - ', '')))
      )) {
        continue;
      }
      
      // Check if we've seen this label before
      const normalizedLabel = mic.label.replace(/^Default -\s*/, '');
      if (!seenLabels.has(normalizedLabel)) {
        seenLabels.set(normalizedLabel, mic);
        uniqueByLabel.push(mic);
      }
    }
    
    // Ensure the default device is first in the list, then sort others alphabetically
    const sortedMicrophones = [...uniqueByLabel].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.label.localeCompare(b.label);
    });
    
    return sortedMicrophones;
  } catch (error) {
    console.error('Error getting microphone devices:', error);
    // Throw the error instead of returning a default device
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'MICROPHONE_ACCESS_FAILED'
    );
  }
};

/**
 * Check if microphone permission has been granted
 * @returns Promise resolving to a boolean indicating if permission is granted
 */
export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // If we have any audio input devices with a non-empty deviceId, we have permission
    return devices.some(device => device.kind === 'audioinput' && device.deviceId !== '');
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
};

/**
 * Request microphone permission
 * @returns Promise resolving to a boolean indicating if permission was granted
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

/**
 * Get a MediaStream for the specified microphone device
 * @param deviceId The ID of the microphone device to use
 * @param options Additional audio constraints
 * @returns Promise resolving to a MediaStream
 */
export const getMicrophoneStream = async (
  deviceId: string = 'default',
  options: MediaTrackConstraints = {}
): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: options.echoCancellation ?? true,
        noiseSuppression: options.noiseSuppression ?? true,
        autoGainControl: options.autoGainControl ?? true,
        sampleRate: options.sampleRate ?? 48000,
        channelCount: options.channelCount ?? 1
      }
    });
  } catch (error) {
    console.error('Error getting microphone stream:', error);
    throw error;
  }
};
