import React from 'react';
import { Settings } from '../types';

interface SettingsPanelProps {
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
    disabled: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, disabled }) => {
    
    const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({ ...settings, silenceThreshold: parseFloat(e.target.value) });
    };
    
    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({ ...settings, minSilenceDuration: parseFloat(e.target.value) });
    };

    const handleMultiplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({ ...settings, pauseMultiplier: parseFloat(e.target.value) });
    };

    return (
        <div className="space-y-4 bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label htmlFor="silence-threshold" className="block text-sm font-medium text-gray-300">
                        Silence Threshold
                    </label>
                    <span className="text-xs font-mono px-2 py-1 bg-gray-700 rounded">{settings.silenceThreshold.toFixed(3)}</span>
                </div>
                <input
                    id="silence-threshold"
                    type="range"
                    min="0.001"
                    max="0.1"
                    step="0.001"
                    value={settings.silenceThreshold}
                    onChange={handleThresholdChange}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                />
                 <p className="text-xs text-gray-500">Lower for quieter audio, higher for noisy audio.</p>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label htmlFor="min-silence-duration" className="block text-sm font-medium text-gray-300">
                        Minimum Silence Duration
                    </label>
                    <span className="text-xs font-mono px-2 py-1 bg-gray-700 rounded">{settings.minSilenceDuration.toFixed(2)}s</span>
                </div>
                <input
                    id="min-silence-duration"
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.05"
                    value={settings.minSilenceDuration}
                    onChange={handleDurationChange}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500">How long a pause should be to count as a sentence break.</p>
            </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label htmlFor="pause-multiplier" className="block text-sm font-medium text-gray-300">
                        Pause Multiplier
                    </label>
                    <span className="text-xs font-mono px-2 py-1 bg-gray-700 rounded">{settings.pauseMultiplier.toFixed(1)}x</span>
                </div>
                <input
                    id="pause-multiplier"
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={settings.pauseMultiplier}
                    onChange={handleMultiplierChange}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500">How long the pause is relative to the speech (e.g., 1.5x).</p>
            </div>
        </div>
    );
};

export default SettingsPanel;