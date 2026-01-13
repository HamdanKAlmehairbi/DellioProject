import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import styles from '../styles/Setup.module.css';
import LoadingAnimation from '../components/LoadingAnimation';
import Camera from '../components/Camera';

const Setup = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const videoRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const streamRef = useRef(null);
    const [isTesting, setIsTesting] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }
        
        if (!localStorage.getItem('interview_user_id')) {
            router.push('/services');
            return;
        }
    }, [status, router]);

    if (status === 'loading') {
        return <LoadingAnimation />;
    }

    if (!session) {
        return null;
    }

    const startMicTest = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;
            setAudioEnabled(true);
            setIsTesting(true);

            // Set up audio analysis
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);
            
            const updateLevel = () => {
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setAudioLevel(average * 3);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check your permissions.");
            setAudioEnabled(false);
            setIsTesting(false);
        }
    };

    const stopMicTest = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsTesting(false);
        // Keep audioEnabled true if the test was successful
    };

    const handleCameraToggle = (enabled) => {
        setVideoEnabled(enabled);
        localStorage.setItem('cameraEnabled', enabled);
    };

    const handleStreamReady = (stream) => {
        setCameraStream(stream);
    };

    const startInterview = async () => {
        try {
            // Store preferences
            localStorage.setItem('video_enabled', videoEnabled.toString());
            
            // No need to wait for backend response, just redirect
            router.push('/interview');
        } catch (error) {
            console.error('Error starting interview:', error);
            alert('Failed to start interview. Please try again.');
        }
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className={styles.setupContainer}>
            <div className={styles.setupCard}>
                <h1>Ready to join?</h1>
                
                <div className={styles.previewContainer}>
                    {videoEnabled ? (
                        <Camera 
                            enabled={videoEnabled} 
                            onStreamReady={handleStreamReady}
                        />
                    ) : (
                        <div className={styles.noVideo}>
                            <div className={styles.userInitial}>
                                {session?.user?.name?.[0] || 'U'}
                            </div>
                        </div>
                    )}
                    
                    {isTesting && (
                        <div className={styles.audioIndicator}>
                            {[...Array(12)].map((_, i) => (
                                <div 
                                    key={i}
                                    className={styles.audioBar}
                                    style={{ 
                                        height: `${Math.min(100, (audioLevel / 256) * 100 * (1 - (i * 0.1)))}%`,
                                        opacity: audioLevel > 20 ? 1 : 0.3
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.controls}>
                    <button 
                        onClick={() => handleCameraToggle(!videoEnabled)}
                        className={`${styles.controlButton} ${videoEnabled ? styles.active : ''}`}
                    >
                        {videoEnabled ? 'Disable Camera' : 'Enable Camera'}
                    </button>
                    <button 
                        onClick={isTesting ? stopMicTest : startMicTest}
                        className={`${styles.controlButton} ${audioEnabled ? styles.active : ''}`}
                    >
                        {isTesting ? 'Stop Test' : 'Test Microphone'}
                    </button>
                </div>

                <button 
                    onClick={startInterview}
                    className={styles.joinButton}
                >
                    Join call
                </button>
            </div>
        </div>
    );
};

export default Setup; 