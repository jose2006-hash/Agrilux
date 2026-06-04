import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, AlertCircle, Loader2 } from 'lucide-react';

export default function ImageCapture({ onCapture, onClose, isOnline }) {
  const [mode, setMode] = useState(null); // null | 'camera' | 'gallery'
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(mediaStream);
      setMode('camera');
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Por favor, habilita la cámara en la configuración.'
          : 'No se pudo acceder a la cámara. Por favor, intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob(
      (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          stopCamera();
          onCapture({
            dataUrl: reader.result,
            preview: reader.result,
            source: 'camera',
            timestamp: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.85
    );
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMode(null);
  };

  const handleGallerySelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        onCapture({
          dataUrl: reader.result,
          preview: reader.result,
          source: 'gallery',
          timestamp: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
    });
  };

  if (!mode) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Agregar foto</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {!isOnline && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Sin conexión. Las fotos se guardarán y subirán automáticamente cuando haya señal.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={startCamera}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-primary to-green-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Camera size={20} />
              )}
              <span className="font-semibold">Tomar foto con cámara</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 p-4 border-2 border-primary text-primary rounded-lg hover:bg-primary hover:bg-opacity-5 transition"
            >
              <ImageIcon size={20} />
              <span className="font-semibold">Seleccionar de galería</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGallerySelect}
              className="hidden"
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg overflow-hidden max-w-lg w-full">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-96 object-cover"
            />
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-4 flex gap-3">
            <button
              onClick={stopCamera}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={capturePhoto}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Capturar foto
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
