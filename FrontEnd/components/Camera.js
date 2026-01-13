import { useRef, useEffect } from 'react';
import styles from '../styles/Camera.module.css';

const Camera = ({ enabled, onStreamReady }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    // Single effect to handle camera lifecycle
    useEffect(() => {
        let mounted = true;

        const setupCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });

                // Only proceed if component is still mounted
                if (mounted && videoRef.current) {
                    streamRef.current = stream;
                    videoRef.current.srcObject = stream;
                    if (onStreamReady) onStreamReady(stream);
                } else {
                    // Clean up if unmounted during setup
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };

        // Start camera on mount if enabled
        if (enabled && !streamRef.current) {
            setupCamera();
        }

        // Cleanup function
        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Handle enabled/disabled state changes
    useEffect(() => {
        if (!enabled && streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        } else if (enabled && !streamRef.current) {
            // Restart camera if enabled and no stream
            const setupCamera = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        if (onStreamReady) onStreamReady(stream);
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                }
            };
            setupCamera();
        }
    }, [enabled, onStreamReady]);

    return (
        <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            className={styles.video}
        />
    );
};

export default Camera;
