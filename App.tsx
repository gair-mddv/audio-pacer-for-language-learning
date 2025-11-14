import React, { useState, useCallback, useMemo } from 'react';
import { ProcessingState, Settings } from './types';
import { processAudioFile } from './services/audioProcessor';
import FileUpload from './components/FileUpload';
import SettingsPanel from './components/SettingsPanel';
import AudioPlayer from './components/AudioPlayer';
import { DownloadIcon, RefreshCwIcon, UploadCloudIcon } from './components/icons';
import Merger from './components/Merger';

const TabButton: React.FC<{ title: string; active: boolean; onClick: () => void }> = ({ title, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 text-sm font-medium transition-colors duration-200 focus:outline-none -mb-px border-b-2
            ${active
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-500'
            }`
        }
    >
        {title}
    </button>
);


const App: React.FC = () => {
    const [mode, setMode] = useState<'pacer' | 'merger'>('pacer');
    const [file, setFile] = useState<File | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
    const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);
    const [processedFileName, setProcessedFileName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<Settings>({
        silenceThreshold: 0.07,
        minSilenceDuration: 0.7,
        pauseMultiplier: 1.5,
    });

    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        if (!selectedFiles || selectedFiles.length === 0) return;
        const selectedFile = selectedFiles[0];

        if (selectedFile.type !== 'audio/mpeg' && selectedFile.type !== 'audio/wav' && selectedFile.type !== 'audio/x-wav') {
            setError('Invalid file type. Please upload an MP3 or WAV file.');
            return;
        }
        setError(null);
        setFile(selectedFile);
        setOriginalAudioUrl(URL.createObjectURL(selectedFile));
        setProcessingState(ProcessingState.READY);
    }, []);

    const handleProcessAudio = useCallback(async () => {
        if (!file) return;

        setProcessingState(ProcessingState.PROCESSING);
        setError(null);
        setProcessedAudioUrl(null);

        try {
            const processedBlob = await processAudioFile(file, settings, setProgressMessage);
            const url = URL.createObjectURL(processedBlob);
            setProcessedAudioUrl(url);

            const originalName = file.name.split('.').slice(0, -1).join('.');
            setProcessedFileName(`${originalName}_paced.wav`);

            setProcessingState(ProcessingState.DONE);
            setProgressMessage('Processing complete!');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
            setError(errorMessage);
            setProcessingState(ProcessingState.ERROR);
            setProgressMessage('');
        }
    }, [file, settings]);

    const handleReset = () => {
        setFile(null);
        setProcessingState(ProcessingState.IDLE);
        setError(null);
        setProgressMessage('');
        if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
        if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);
        setOriginalAudioUrl(null);
        setProcessedAudioUrl(null);
        setProcessedFileName('');
    };

    const isProcessing = useMemo(() => processingState === ProcessingState.PROCESSING, [processingState]);

    const resetPacerStateForModeSwitch = () => {
        if (processingState !== ProcessingState.IDLE) {
            handleReset();
        }
        setError(null);
    }

    const handleModeChange = (newMode: 'pacer' | 'merger') => {
        resetPacerStateForModeSwitch();
        setMode(newMode);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                        Audio Toolkit
                    </h1>
                    <p className="mt-2 text-gray-400">Pace or merge your language learning audio files.</p>
                </header>
                
                <main className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700/50">
                     <div className="flex mb-6 border-b border-gray-700">
                        <TabButton title="Pacer" active={mode === 'pacer'} onClick={() => handleModeChange('pacer')} />
                        <TabButton title="Merger" active={mode === 'merger'} onClick={() => handleModeChange('merger')} />
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {mode === 'pacer' && (
                        <>
                           {processingState === ProcessingState.IDLE && (
                                <FileUpload onFileSelect={handleFileSelect} multiple={false} />
                            )}

                            {(processingState === ProcessingState.READY || isProcessing) && file && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-teal-300">{file.name}</p>
                                        <p className="text-sm text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                                    </div>
                                    <SettingsPanel settings={settings} onSettingsChange={setSettings} disabled={isProcessing} />
                                    <div className="flex justify-center">
                                        <button
                                            onClick={handleProcessAudio}
                                            disabled={isProcessing}
                                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-teal-500/30"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <RefreshCwIcon className="animate-spin h-5 w-5" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                'Start Processing'
                                            )}
                                        </button>
                                    </div>
                                    {isProcessing && <p className="text-center text-teal-400 animate-pulse">{progressMessage}</p>}
                                </div>
                            )}
                            
                            {processingState === ProcessingState.DONE && processedAudioUrl && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-semibold text-center text-teal-300">Results</h2>
                                    {originalAudioUrl && <AudioPlayer src={originalAudioUrl} title="Original Audio" />}
                                    <AudioPlayer src={processedAudioUrl} title="Paced Audio (with pauses)" />
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <a
                                            href={processedAudioUrl}
                                            download={processedFileName}
                                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors duration-300 shadow-lg hover:shadow-blue-500/30"
                                        >
                                            <DownloadIcon className="h-5 w-5" />
                                            Download Paced Audio
                                        </a>
                                        <button
                                            onClick={handleReset}
                                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors duration-300"
                                        >
                                            <UploadCloudIcon className="h-5 w-5" />
                                            Process Another File
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
                        </>
                    )}

                    {mode === 'merger' && <Merger />}

                </main>

                <footer className="text-center text-gray-500 text-sm">
                    <p>Designed for language learners. Enjoy your practice!</p>
                </footer>
            </div>
        </div>
    );
};

export default App;