import { Settings, SpeechChunk } from '../types';

// FIX: Cast window to any to allow for webkitAudioContext fallback for older browsers.
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

async function decodeAudio(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

function detectSpeechChunks(audioBuffer: AudioBuffer, settings: Settings): SpeechChunk[] {
    const { silenceThreshold, minSilenceDuration } = settings;
    const channelData = audioBuffer.getChannelData(0); // Use the first channel
    const sampleRate = audioBuffer.sampleRate;
    const minSilenceSamples = sampleRate * minSilenceDuration;

    const chunks: SpeechChunk[] = [];
    let speechStart = -1;

    for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > silenceThreshold && speechStart < 0) {
            speechStart = i;
        }

        if (Math.abs(channelData[i]) < silenceThreshold && speechStart >= 0) {
            let silenceEnd = i;
            let isSilenceLongEnough = true;
            for (let j = i; j < i + minSilenceSamples && j < channelData.length; j++) {
                if (Math.abs(channelData[j]) > silenceThreshold) {
                    isSilenceLongEnough = false;
                    i = j; // Skip forward to the next speech part
                    break;
                }
            }

            if (isSilenceLongEnough) {
                chunks.push({ start: speechStart, end: i });
                speechStart = -1;
                i += minSilenceSamples; // Skip past the silence
            }
        }
    }

    // Add the last chunk if the audio ends with speech
    if (speechStart >= 0) {
        chunks.push({ start: speechStart, end: channelData.length });
    }

    return chunks;
}

function createPaddedAudio(originalBuffer: AudioBuffer, chunks: SpeechChunk[], settings: Settings): AudioBuffer {
    const { numberOfChannels, sampleRate } = originalBuffer;
    const { pauseMultiplier } = settings;
    
    let totalLength = 0;
    for (const chunk of chunks) {
        const chunkDuration = chunk.end - chunk.start;
        // The new total length is the chunk itself plus the multiplied pause
        totalLength += chunkDuration * (1 + pauseMultiplier); 
    }

    if (totalLength === 0) {
        throw new Error("No speech detected in the audio file. Try adjusting the silence threshold.");
    }
    
    // Use Math.ceil to ensure the buffer is large enough and we have an integer.
    const newBuffer = audioContext.createBuffer(numberOfChannels, Math.ceil(totalLength), sampleRate);

    let currentPosition = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const originalData = originalBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        currentPosition = 0;
        for (const chunk of chunks) {
            const chunkDuration = chunk.end - chunk.start;
            const chunkData = originalData.subarray(chunk.start, chunk.end);
            
            // Use Math.round on the position to avoid floating point errors
            newData.set(chunkData, Math.round(currentPosition));
            currentPosition += chunkDuration;
            
            // The silence is added by advancing the current position
            // This now respects the multiplier from settings
            currentPosition += chunkDuration * pauseMultiplier;
        }
    }

    return newBuffer;
}

function encodeMp3(audioBuffer: AudioBuffer): Blob {
    const lamejs = (window as any).lamejs;
    if (typeof lamejs === 'undefined') {
        throw new Error('lamejs library is not loaded. Please include it in your HTML.');
    }

    const { numberOfChannels, sampleRate } = audioBuffer;
    const mp3encoder = new lamejs.Mp3Encoder(numberOfChannels, sampleRate, 128); // 128 kbps
    const mp3Data = [];

    const convertBuffer = (buffer: Float32Array): Int16Array => {
        const data = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            data[i] = Math.max(-1, Math.min(1, buffer[i])) * 32767;
        }
        return data;
    };

    const left = convertBuffer(audioBuffer.getChannelData(0));
    const right = numberOfChannels > 1 ? convertBuffer(audioBuffer.getChannelData(1)) : undefined;

    const sampleBlockSize = 1152;
    for (let i = 0; i < left.length; i += sampleBlockSize) {
        const leftChunk = left.subarray(i, i + sampleBlockSize);
        let rightChunk;
        if (right) {
            rightChunk = right.subarray(i, i + sampleBlockSize);
        }

        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }
    
    return new Blob(mp3Data, { type: 'audio/mpeg' });
}


export async function processAudioFile(
    file: File,
    settings: Settings,
    setProgress: (message: string) => void
): Promise<Blob> {
    setProgress('Step 1/4: Decoding audio...');
    const originalBuffer = await decodeAudio(file);

    setProgress('Step 2/4: Analyzing for speech...');
    const speechChunks = detectSpeechChunks(originalBuffer, settings);
    
    if (speechChunks.length === 0) {
        throw new Error("Could not detect any speech. Please try adjusting the 'Silence Threshold' slider to be lower.");
    }

    setProgress(`Step 3/4: Reconstructing audio with pauses... (found ${speechChunks.length} phrases)`);
    const newBuffer = createPaddedAudio(originalBuffer, speechChunks, settings);

    setProgress('Step 4/4: Encoding final MP3 file...');
    const mp3Blob = encodeMp3(newBuffer);
    
    return mp3Blob;
}

export async function mergeAudioFiles(
    files: File[],
    setProgress: (message: string) => void
): Promise<Blob> {
    if (files.length < 2) {
        throw new Error("At least two files are required to merge.");
    }

    const totalSteps = files.length + 2;
    setProgress(`Step 1/${totalSteps}: Decoding audio files...`);

    const decodedBuffers: AudioBuffer[] = [];
    for (let i = 0; i < files.length; i++) {
        setProgress(`Decoding ${i + 1}/${files.length}: ${files[i].name}...`);
        const buffer = await decodeAudio(files[i]);
        decodedBuffers.push(buffer);
    }

    setProgress(`Step ${files.length + 1}/${totalSteps}: Validating audio properties...`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay for UI update

    const firstBuffer = decodedBuffers[0];
    const { sampleRate, numberOfChannels } = firstBuffer;

    let totalLength = 0;
    for (const buffer of decodedBuffers) {
        if (buffer.sampleRate !== sampleRate) {
            throw new Error(`Mismatched sample rates. All files must have a sample rate of ${sampleRate} Hz.`);
        }
        if (buffer.numberOfChannels !== numberOfChannels) {
            throw new Error(`Mismatched channel counts. All files must have ${numberOfChannels} channel(s).`);
        }
        totalLength += buffer.length;
    }

    setProgress(`Step ${files.length + 2}/${totalSteps}: Merging audio...`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay for UI update

    const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);
    let offset = 0;

    for (const buffer of decodedBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            mergedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    }
    
    const mp3Blob = encodeMp3(mergedBuffer);
    return mp3Blob;
}