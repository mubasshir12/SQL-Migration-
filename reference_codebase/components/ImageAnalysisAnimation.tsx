
import React from 'react';

const ImageAnalysisAnimation: React.FC = () => {
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
            <div className="flex space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s] shadow-sm"></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.15s] shadow-sm"></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce shadow-sm"></div>
            </div>
        </div>
    );
};

export default ImageAnalysisAnimation;
