import { Settings, SpeechChunk } from '../types';

// FIX: Cast window to any to allow for webkitAudioContext fallback for older browsers.
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

async function decodeAudio(file: Blob): Promise<AudioBuffer> {
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

export async function processZipArchive(
    zipFile: File,
    pauseMultiplier: number,
    fixedSilenceDuration: number,
    setProgress: (message: string) => void
): Promise<{ pacedBlob: Blob, mergedBlob: Blob, count: number }> {
    const JSZip = (window as any).JSZip;
    if (!JSZip) {
        throw new Error("JSZip library not found.");
    }

    setProgress("Step 1/6: Loading archive...");
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);

    setProgress("Step 2/6: Extracting and sorting audio files...");
    
    // Get all files that look like audio
    const fileEntries: Array<{ name: string; obj: any }> = [];
    
    zip.forEach((relativePath: string, zipEntry: any) => {
        if (!zipEntry.dir && !relativePath.includes('__MACOSX')) {
            const lowerName = relativePath.toLowerCase();
            if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav')) {
                fileEntries.push({ name: relativePath, obj: zipEntry });
            }
        }
    });

    if (fileEntries.length === 0) {
        throw new Error("No MP3 or WAV files found in the archive.");
    }

    // Sort files naturally (1, 2, 10 instead of 1, 10, 2)
    fileEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    setProgress(`Step 3/6: Decoding ${fileEntries.length} audio files...`);
    const decodedBuffers: AudioBuffer[] = [];

    for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i];
        setProgress(`Decoding ${i + 1}/${fileEntries.length}: ${entry.name.split('/').pop()}`);
        const arrayBuffer = await entry.obj.async("arraybuffer");
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        decodedBuffers.push(audioBuffer);
    }

    // Check consistency (Sample Rate/Channels) based on first file
    const reference = decodedBuffers[0];
    const { sampleRate, numberOfChannels } = reference;
    
    // Calculate total lengths
    let totalPacedLength = 0;
    let totalMergedLength = 0;
    
    const fixedSilenceSamples = Math.floor(sampleRate * fixedSilenceDuration);

    for (const buffer of decodedBuffers) {
        if (buffer.sampleRate !== sampleRate) {
            throw new Error(`Sample rate mismatch in ${fileEntries[decodedBuffers.indexOf(buffer)].name}. Expected ${sampleRate}Hz.`);
        }
        if (buffer.numberOfChannels !== numberOfChannels) {
             throw new Error(`Channel count mismatch in ${fileEntries[decodedBuffers.indexOf(buffer)].name}.`);
        }

        // Paced Length Calculation
        totalPacedLength += buffer.length + Math.ceil(buffer.length * pauseMultiplier);
        
        // Merged Length Calculation (Buffer + Fixed Silence)
        totalMergedLength += buffer.length + fixedSilenceSamples;
    }

    setProgress(`Step 4/6: constructing buffers...`);
    
    const pacedBuffer = audioContext.createBuffer(numberOfChannels, totalPacedLength, sampleRate);
    const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalMergedLength, sampleRate);
    
    let pacedOffset = 0;
    let mergedOffset = 0;

    for (const buffer of decodedBuffers) {
        const fileDuration = buffer.length;
        
        // --- Fill Paced Buffer ---
        for (let channel = 0; channel < numberOfChannels; channel++) {
            pacedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), pacedOffset);
        }
        const pacedSilence = Math.ceil(fileDuration * pauseMultiplier);
        pacedOffset += fileDuration + pacedSilence;

        // --- Fill Merged Buffer ---
        for (let channel = 0; channel < numberOfChannels; channel++) {
            mergedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), mergedOffset);
        }
        mergedOffset += fileDuration + fixedSilenceSamples;
    }

    setProgress("Step 5/6: Encoding Paced MP3...");
    const pacedBlob = encodeMp3(pacedBuffer);

    setProgress("Step 6/6: Encoding Fast MP3...");
    const mergedBlob = encodeMp3(mergedBuffer);

    return { pacedBlob, mergedBlob, count: fileEntries.length };
}