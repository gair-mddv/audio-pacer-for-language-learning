import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ProcessingState } from '../types';
import FileUpload from './FileUpload';
import { mergeAudioFiles } from '../services/audioProcessor';
import { DownloadIcon, GripVerticalIcon, RefreshCwIcon, UploadCloudIcon, XIcon } from './icons';
import AudioPlayer from './AudioPlayer';

const Merger: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
    const [mergedFileName, setMergedFileName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Ref to track the index of the item being dragged
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        const validFiles = selectedFiles.filter(file => 
            file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.type === 'audio/x-wav'
        );

        if (validFiles.length !== selectedFiles.length) {
            setError('Invalid file type detected. Please upload only MP3 or WAV files.');
        } else {
            setError(null);
        }

        setFiles(prevFiles => [...prevFiles, ...validFiles]);
        setProcessingState(ProcessingState.READY);
    }, []);
    
    const handleRemoveFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;

        const newFiles = [...files];
        const draggedItemContent = newFiles.splice(dragItem.current, 1)[0];
        newFiles.splice(dragOverItem.current, 0, draggedItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        
        setFiles(newFiles);
    };

    const handleMerge = useCallback(async () => {
        if (files.length < 2) {
            setError("Please select at least two files to merge.");
            return;
        }

        setProcessingState(ProcessingState.PROCESSING);
        setError(null);
        setMergedAudioUrl(null);

        try {
            const mergedBlob = await mergeAudioFiles(files, setProgressMessage);
            const url = URL.createObjectURL(mergedBlob);
            setMergedAudioUrl(url);
            setMergedFileName(`merged_audio_${new Date().getTime()}.wav`);
            setProcessingState(ProcessingState.DONE);
            setProgressMessage('Merging complete!');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during merging.';
            setError(errorMessage);
            setProcessingState(ProcessingState.ERROR);
            setProgressMessage('');
        }
    }, [files]);
    
    const handleReset = () => {
        setFiles([]);
        setProcessingState(ProcessingState.IDLE);
        setError(null);
        setProgressMessage('');
        if (mergedAudioUrl) URL.revokeObjectURL(mergedAudioUrl);
        setMergedAudioUrl(null);
        setMergedFileName('');
    };
    
    const isProcessing = useMemo(() => processingState === ProcessingState.PROCESSING, [processingState]);

    if (processingState === ProcessingState.IDLE) {
        return <FileUpload onFileSelect={handleFileSelect} multiple={true} />;
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {processingState !== ProcessingState.DONE && processingState !== ProcessingState.ERROR && (
                <>
                    <h2 className="text-xl font-semibold text-center text-teal-300">Files to Merge</h2>
                    <p className="text-center text-sm text-gray-400 -mt-4">Drag and drop to reorder files.</p>
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                             <li
                                key={index}
                                draggable
                                onDragStart={() => dragItem.current = index}
                                onDragEnter={() => dragOverItem.current = index}
                                onDragEnd={handleDragSort}
                                onDragOver={(e) => e.preventDefault()}
                                className="flex items-center bg-gray-700/50 p-3 rounded-lg border border-gray-600/50 cursor-grab active:cursor-grabbing"
                            >
                                <GripVerticalIcon className="h-5 w-5 text-gray-500 mr-3 shrink-0" />
                                <span className="flex-grow text-sm text-gray-200 truncate" title={file.name}>{file.name}</span>
                                <span className="text-xs text-gray-400 ml-3 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                                <button onClick={() => handleRemoveFile(index)} className="ml-3 text-gray-500 hover:text-red-400 transition-colors">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                     <div className="pt-2">
                        <FileUpload onFileSelect={handleFileSelect} multiple={true} />
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleMerge}
                            disabled={isProcessing || files.length < 2}
                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-teal-500/30"
                        >
                             {isProcessing ? (
                                <>
                                    <RefreshCwIcon className="animate-spin h-5 w-5" />
                                    <span>Merging...</span>
                                </>
                            ) : (
                                `Merge ${files.length} Files`
                            )}
                        </button>
                    </div>
                </>
            )}

            {isProcessing && <p className="text-center text-teal-400 animate-pulse">{progressMessage}</p>}
            
            {processingState === ProcessingState.DONE && mergedAudioUrl && (
                 <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-center text-teal-300">Merge Complete</h2>
                    <AudioPlayer src={mergedAudioUrl} title="Merged Audio" />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <a
                            href={mergedAudioUrl}
                            download={mergedFileName}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors duration-300 shadow-lg hover:shadow-blue-500/30"
                        >
                            <DownloadIcon className="h-5 w-5" />
                            Download Merged Audio
                        </a>
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors duration-300"
                        >
                            <UploadCloudIcon className="h-5 w-5" />
                            Merge More Files
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

export default Merger;
