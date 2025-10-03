import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export const EnhancedAudioUpload: React.FC = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      simulateUpload(file);
    }
  }, []);

  const simulateUpload = async (file: File) => {
    setIsProcessing(true);
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setIsProcessing(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'] },
    multiple: false
  });

  return (
    <div className="enhanced-upload-container">
      <div {...getRootProps()} className={`drop-zone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        {audioFile ? (
          <div className="file-preview">
            <span>📄 {audioFile.name}</span>
            <span>{(audioFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        ) : (
          <div className="upload-prompt">
            <p>🎵 Drag & drop audio file here, or click to select</p>
            <p>Supports: MP3, WAV, M4A, OGG</p>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span>{uploadProgress}% uploaded</span>
        </div>
      )}
    </div>
  );
};
