
import React from 'react';

interface AudioPlayerProps {
    src: string;
    title: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, title }) => {
    return (
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600/50">
            <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
            <audio controls src={src} className="w-full">
                Your browser does not support the audio element.
            </audio>
        </div>
    );
};

export default AudioPlayer;
