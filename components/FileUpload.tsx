import React, { useState, useCallback } from 'react';
import { UploadCloudIcon } from './icons';

interface FileUploadProps {
    onFileSelect: (files: File[]) => void;
    multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, multiple = false }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(Array.from(e.target.files));
        }
    };
    
    const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    
    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    
    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    }, [onFileSelect]);

    return (
        <label
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
                ${isDragging ? 'border-teal-400 bg-gray-700/50' : 'border-gray-600 bg-gray-800/20 hover:bg-gray-700/30'}`}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloudIcon className={`w-10 h-10 mb-4 text-gray-400 transition-transform duration-300 ${isDragging ? 'scale-110 text-teal-300' : ''}`} />
                <p className="mb-2 text-sm text-gray-400">
                    <span className="font-semibold text-teal-300">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">MP3 or WAV files</p>
            </div>
            <input id="dropzone-file" type="file" className="hidden" accept="audio/mpeg,audio/wav" onChange={handleFileChange} multiple={multiple} />
        </label>
    );
};

export default FileUpload;
