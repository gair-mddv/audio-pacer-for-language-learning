import React, { useState, useCallback, useMemo } from 'react';
import { ProcessingState } from '../types';
import FileUpload from './FileUpload';
import { processZipArchive } from '../services/audioProcessor';
import { DownloadIcon, RefreshCwIcon, UploadCloudIcon } from './icons';
import AudioPlayer from './AudioPlayer';

const ArchivePacer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
    const [progressMessage, setProgressMessage] = useState<string>('');
    
    // Outputs
    const [pacedAudioUrl, setPacedAudioUrl] = useState<string | null>(null);
    const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
    const [originalFileName, setOriginalFileName] = useState<string>('');
    
    const [fileCount, setFileCount] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    
    // Settings
    const [pauseMultiplier, setPauseMultiplier] = useState<number>(1.5);
    const [fixedSilence, setFixedSilence] = useState<number>(1.0);

    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        if (!selectedFiles || selectedFiles.length === 0) return;
        const selectedFile = selectedFiles[0];

        if (selectedFile.type !== 'application/zip' && selectedFile.type !== 'application/x-zip-compressed' && !selectedFile.name.endsWith('.zip')) {
            setError('Invalid file type. Please upload a ZIP archive.');
            return;
        }

        setError(null);
        setFile(selectedFile);
        setOriginalFileName(selectedFile.name.split('.').slice(0, -1).join('.'));
        setProcessingState(ProcessingState.READY);
    }, []);

    const handleProcessArchive = useCallback(async () => {
        if (!file) return;

        setProcessingState(ProcessingState.PROCESSING);
        setError(null);
        setPacedAudioUrl(null);
        setMergedAudioUrl(null);

        try {
            const result = await processZipArchive(file, pauseMultiplier, fixedSilence, setProgressMessage);
            
            setPacedAudioUrl(URL.createObjectURL(result.pacedBlob));
            setMergedAudioUrl(URL.createObjectURL(result.mergedBlob));
            setFileCount(result.count);

            setProcessingState(ProcessingState.DONE);
            setProgressMessage('Processing complete!');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
            setError(errorMessage);
            setProcessingState(ProcessingState.ERROR);
            setProgressMessage('');
        }
    }, [file, pauseMultiplier, fixedSilence]);

    const handleReset = () => {
        setFile(null);
        setProcessingState(ProcessingState.IDLE);
        setError(null);
        setProgressMessage('');
        
        if (pacedAudioUrl) URL.revokeObjectURL(pacedAudioUrl);
        if (mergedAudioUrl) URL.revokeObjectURL(mergedAudioUrl);
        
        setPacedAudioUrl(null);
        setMergedAudioUrl(null);
        setOriginalFileName('');
        setFileCount(0);
    };

    const isProcessing = useMemo(() => processingState === ProcessingState.PROCESSING, [processingState]);

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-4" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {processingState === ProcessingState.IDLE && (
                <>
                    <div className="text-center mb-4">
                         <p className="text-gray-400 text-sm">Upload a .zip file containing split audio files (e.g., one sentence per file).</p>
                    </div>
                    <FileUpload onFileSelect={handleFileSelect} multiple={false} />
                </>
            )}

            {(processingState === ProcessingState.READY || isProcessing) && file && (
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-lg font-semibold text-teal-300">{file.name}</p>
                        <p className="text-sm text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                    </div>

                    <div className="space-y-6 bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
                         {/* Setting 1: Pacer Multiplier */}
                         <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="pause-multiplier" className="block text-sm font-medium text-teal-200">
                                    Practice Mode Pause
                                </label>
                                <span className="text-xs font-mono px-2 py-1 bg-gray-700 rounded">{pauseMultiplier.toFixed(1)}x</span>
                            </div>
                            <input
                                id="pause-multiplier"
                                type="range"
                                min="0.5"
                                max="3.0"
                                step="0.1"
                                value={pauseMultiplier}
                                onChange={(e) => setPauseMultiplier(parseFloat(e.target.value))}
                                disabled={isProcessing}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                            />
                            <p className="text-xs text-gray-500">
                                Relative silence (e.g., 2s audio + <strong>{pauseMultiplier}x</strong> silence).
                            </p>
                        </div>

                        {/* Setting 2: Fixed Silence */}
                        <div className="space-y-2 pt-2 border-t border-gray-700/50">
                            <div className="flex justify-between items-center">
                                <label htmlFor="fixed-silence" className="block text-sm font-medium text-blue-200">
                                    Fast Mode Pause
                                </label>
                                <span className="text-xs font-mono px-2 py-1 bg-gray-700 rounded">{fixedSilence.toFixed(1)}s</span>
                            </div>
                            <input
                                id="fixed-silence"
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={fixedSilence}
                                onChange={(e) => setFixedSilence(parseFloat(e.target.value))}
                                disabled={isProcessing}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                            />
                            <p className="text-xs text-gray-500">
                                Fixed silence between sentences (e.g., <strong>{fixedSilence}s</strong>).
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleProcessArchive}
                            disabled={isProcessing}
                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-teal-500/30"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCwIcon className="animate-spin h-5 w-5" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                'Process & Generate Both Files'
                            )}
                        </button>
                    </div>
                    {isProcessing && <p className="text-center text-teal-400 animate-pulse">{progressMessage}</p>}
                </div>
            )}

            {processingState === ProcessingState.DONE && pacedAudioUrl && mergedAudioUrl && (
                <div className="space-y-8">
                    <h2 className="text-2xl font-semibold text-center text-teal-300">Results ({fileCount} files)</h2>
                    
                    {/* Result 1: Paced Audio */}
                    <div className="bg-gray-800/40 p-5 rounded-xl border border-teal-900/50 shadow-lg">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium text-teal-200">1. Practice Audio (Paced)</h3>
                            <p className="text-xs text-gray-400">Used for shadowing. Variable pauses ({pauseMultiplier}x).</p>
                        </div>
                        <div className="space-y-4">
                            <AudioPlayer src={pacedAudioUrl} title={`${originalFileName} (Paced)`} />
                            <a
                                href={pacedAudioUrl}
                                download={`${originalFileName}_paced.mp3`}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-teal-700 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors duration-300"
                            >
                                <DownloadIcon className="h-5 w-5" />
                                Download Practice Audio
                            </a>
                        </div>
                    </div>

                    {/* Result 2: Merged Audio */}
                    <div className="bg-gray-800/40 p-5 rounded-xl border border-blue-900/50 shadow-lg">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium text-blue-200">2. Fast Audio (Merged)</h3>
                            <p className="text-xs text-gray-400">Used for listening. Fixed pauses ({fixedSilence}s).</p>
                        </div>
                        <div className="space-y-4">
                             <AudioPlayer src={mergedAudioUrl} title={`${originalFileName} (Fast)`} />
                            <a
                                href={mergedAudioUrl}
                                download={`${originalFileName}_fast.mp3`}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors duration-300"
                            >
                                <DownloadIcon className="h-5 w-5" />
                                Download Fast Audio
                            </a>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors duration-300"
                        >
                            <UploadCloudIcon className="h-5 w-5" />
                            Process Another Archive
                        </button>
                    </div>
                </div>
            )}

            {processingState === ProcessingState.ERROR && (
                <div className="text-center">
                    <button
                        onClick={handleReset}
                        className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors duration-300"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};

export default ArchivePacer;