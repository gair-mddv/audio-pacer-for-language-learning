export enum ProcessingState {
    IDLE = 'idle',
    READY = 'ready',
    PROCESSING = 'processing',
    DONE = 'done',
    ERROR = 'error',
}

export interface Settings {
    silenceThreshold: number;
    minSilenceDuration: number;
    pauseMultiplier: number;
}

export interface SpeechChunk {
    start: number;
    end: number;
}