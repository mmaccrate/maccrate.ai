// src/types/stage.ts
// Simplified stage types for 2D implementation

/**
 * Simplified zoom levels for 2D stage
 * Only macro (full stage) and micro (instrument detail)
 */
export type ZoomLevel = 'macro' | 'micro';

/**
 * Camera configuration for zoom level
 */
export interface ZoomConfig {
  level: ZoomLevel;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

/**
 * Instrument slot configuration
 */
export interface InstrumentSlot {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  instrumentType: InstrumentType;
  section: BandSection;
  status: InstrumentStatus;
  content: {
    title: string;
    description: string;
    url?: string;
    icon: string;
  };
}

export type InstrumentType = 
  | 'saxophone'
  | 'trumpet'
  | 'trombone'
  | 'piano'
  | 'bass'
  | 'drums'
  | 'guitar';

export type BandSection = 
  | 'reeds'
  | 'brass'
  | 'rhythm';

export type InstrumentStatus = 
  | 'live'
  | 'coming-soon'
  | 'empty';

/**
 * Stage configuration
 */
export interface StageConfig {
  camera: {
    macro: { x: number; y: number; z: number };
    microOffset: { x: number; y: number; z: number };
  };
  animation: {
    duration: number;
    easing: 'easeInOutCubic';
  };
}

/**
 * Default stage configuration
 */
export const DEFAULT_STAGE_CONFIG: StageConfig = {
  camera: {
    macro: { x: 0, y: 8, z: 45 },
    microOffset: { x: 0, y: 5, z: 15 }
  },
  animation: {
    duration: 800,
    easing: 'easeInOutCubic'
  }
};

/**
 * Camera transition event data
 */
export interface CameraTransitionEvent {
  level: ZoomLevel;
  instrument: string | null;
  position: { x: number; y: number; z: number };
}

/**
 * Hover event data
 */
export interface HoverEvent {
  instrumentId: string;
  isHovered: boolean;
}

/**
 * Click event data
 */
export interface ClickEvent {
  instrumentId: string;
  position: { x: number; y: number; z: number };
}
