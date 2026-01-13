import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import styles from '../styles/Interview.module.css';
import Image from 'next/image';
import Camera from '../components/Camera';

// Helper function to convert base64 to Blob
const base64ToBlob = (base64) => {
    try {
        const base64Data = base64.split(',')[1] || base64;
        const binaryStr = window.atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        
        return new Blob([bytes], { type: 'audio/mp3' });
    } catch (error) {
        console.error('Error converting base64 to blob:', error);
        return null;
    }
};

// Helper function to clean message text
const cleanMessage = (text) => {
    // Remove numbered prefixes like "1.", "2.", etc.
    return text.replace(/^\d+\.\s*/g, '');
};

const Interview = () => {
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    const [isInterviewerTurn, setIsInterviewerTurn] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [autoRecordingFailed, setAutoRecordingFailed] = useState(false);
    const { data: session, status } = useSession();
    const router = useRouter();

    const wsRef = useRef(null);
    const audioRef = useRef(null);
    const isPlayingRef = useRef(false);
    const chatBoxRef = useRef(null);
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [audioQueue, setAudioQueue] = useState([]);
    const [pendingMessages, setPendingMessages] = useState([]);
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
    const isPlaying = useRef(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showRecordingPrompt, setShowRecordingPrompt] = useState(false);
    const isInitializedRef = useRef(false);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [currentSpeaker, setCurrentSpeaker] = useState('interviewer');
    const [showKeyHint, setShowKeyHint] = useState(false);
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);

    // Auto-scroll functionality
    const scrollToBottom = useCallback(() => {
        if (chatBoxRef.current) {
            const chatBox = chatBoxRef.current;
            const isNearBottom = chatBox.scrollHeight - chatBox.clientHeight - chatBox.scrollTop < 100;
            
            // Always scroll on user messages or if near bottom
            if (isNearBottom || messages[messages.length - 1]?.role === 'user') {
                // Use RAF for smooth scrolling
                requestAnimationFrame(() => {
                    chatBox.scrollTo({
                        top: chatBox.scrollHeight,
                        behavior: 'smooth'
                    });
                });
            }
        }
    }, [messages]);

    // Scroll on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Scroll on new pending messages
    useEffect(() => {
        if (pendingMessages.length > 0) {
            scrollToBottom();
        }
    }, [pendingMessages, scrollToBottom]);

    // Scroll when audio finishes playing
    useEffect(() => {
        if (!currentlyPlaying && messages.length > 0) {
            scrollToBottom();
        }
    }, [currentlyPlaying, messages, scrollToBottom]);

    // Recording controls
    useEffect(() => {
        const handleKeyPress = async (e) => {
            if ((e.code === 'Space' || e.code === 'Enter') && isRecording) {
                e.preventDefault();
                setShowRecordingPrompt(false);
                setIsRecording(false);
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isRecording]);

    // WebSocket and audio handling
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        const handleWebSocketMessage = async (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'speaker_change':
                    setIsInterviewerTurn(data.speaker === 'interviewer');
                    
                    // Don't start recording immediately for user turn
                    // Just store that we should start recording after messages finish
                    if (data.speaker === 'user' && data.showPrompt) {
                        // We'll handle recording start in the audio queue effect
                        setIsInterviewerTurn(false);
                    }
                    break;

                case 'sentence':
                    setPendingMessages(prev => [...prev, {
                        role: 'interviewer',
                        content: data.text,
                        audio: data.audio
                    }]);
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        };

        const initializeInterview = async () => {
            if (status === 'authenticated' && session?.backendToken && !isInitializedRef.current) {
                try {
                    const userId = localStorage.getItem('interview_user_id');
                    if (!userId) {
                        throw new Error('No interview session found');
                    }

                    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                        // Always start a new session after document submission
                        const isNewSession = true;
                        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/interview?token=${session.backendToken}&user_id=${userId}&new_session=${isNewSession}`;
                        
                        const ws = new WebSocket(wsUrl);
                        wsRef.current = ws;

                        // Keep track of connection state
                        let isClosing = false;

                        ws.onopen = () => {
                            setIsConnected(true);
                            setError('');
                            isInitializedRef.current = true;
                        };

                        ws.onmessage = handleWebSocketMessage;

                        ws.onerror = (error) => {
                            console.error('WebSocket error:', error);
                            if (!isClosing) {
                                setError('Connection error occurred');
                            }
                        };

                        ws.onclose = (event) => {
                            isClosing = true;
                            setIsConnected(false);
                            console.log('WebSocket closed:', event.code, event.reason);
                            
                            // Don't clear messages when switching tabs
                            if (event.code !== 1000) { // Normal closure
                                setPendingMessages([]);
                                setCurrentlyPlaying(null);
                            }
                        };
                    }
                } catch (error) {
                    console.error('Interview initialization error:', error);
                    setError('Failed to initialize interview');
                }
            }
        };

        initializeInterview();

        // Cleanup function
        return () => {
            if (wsRef.current) {
                wsRef.current.close(1000, "Normal closure");
            }
        };
    }, [status, session, router]);

    // Add this useEffect for handling auto-scroll
    useEffect(() => {
        if (chatBoxRef.current) {
            const scrollToBottom = () => {
                const chatBox = chatBoxRef.current;
                chatBox.scrollTop = chatBox.scrollHeight;
            };

            // Scroll immediately
            scrollToBottom();

            // Also scroll after a brief delay to handle any pending content updates
            const timeoutId = setTimeout(scrollToBottom, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [messages, currentlyPlaying]); // Add currentlyPlaying to dependencies

    // Audio queue management - This is where we'll start recording
    useEffect(() => {
        const playNextInQueue = async () => {
            if (currentlyPlaying || pendingMessages.length === 0) return;

            const nextMessage = pendingMessages[0];
            setCurrentlyPlaying(nextMessage);

            try {
                const audioBlob = base64ToBlob(nextMessage.audio);
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Show message when audio starts playing
                audio.onplay = () => {
                    setMessages(prev => [...prev, {
                        role: 'interviewer',
                        content: nextMessage.content
                    }]);
                };

                // Clean up when audio finishes
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    setCurrentlyPlaying(null);
                    setPendingMessages(prev => prev.slice(1));

                    // If this was the last message and we're in user turn, start recording
                    if (pendingMessages.length === 1 && !isInterviewerTurn) {
                        setShowKeyHint(true);
                        startRecording();
                    }
                };

                await audio.play();
            } catch (error) {
                console.error('Error playing audio:', error);
                setCurrentlyPlaying(null);
                setPendingMessages(prev => prev.slice(1));
            }
        };

        playNextInQueue();
    }, [currentlyPlaying, pendingMessages, isInterviewerTurn]);

    // Recording functionality
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob);
                    
                    const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                    const response = await fetch(`${backendURL}/transcribe`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.backendToken}`
                        },
                        body: formData
                    });
                    
                    if (response.ok) {
                        const { text } = await response.json();
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            setMessages(prev => [...prev, { role: 'user', content: text }]);
                            wsRef.current.send(text);
                            setAutoRecordingFailed(false);
                        }
                    } else {
                        throw new Error('Transcription failed');
                    }
                } catch (error) {
                    console.error('Error sending audio:', error);
                    setError('Failed to process audio');
                    setAutoRecordingFailed(true);
                }
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
            setAutoRecordingFailed(false);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setAutoRecordingFailed(true);
            setIsListening(false);
        }
    };

    // Update toggleRecording function
    const toggleRecording = async (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && isListening) {
            e.preventDefault();
            setIsListening(false);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        } else if ((e.code === 'Space' || e.code === 'Enter') && !isListening && !isInterviewerTurn) {
            e.preventDefault();
            startRecording();
        }
    };

    // Update keyboard event listener
    useEffect(() => {
        const handleKeyPress = async (e) => {
            if ((e.code === 'Space' || e.code === 'Enter') && !isInterviewerTurn) {
                e.preventDefault();
                if (isListening) {
                    setIsListening(false);
                    setShowKeyHint(false);
                    setCurrentSpeaker('interviewer');
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        mediaRecorderRef.current.stop();
                        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                    }
                } else {
                    setShowKeyHint(true);
                    setCurrentSpeaker('user');
                    startRecording();
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isListening, isInterviewerTurn, currentSpeaker]);

    // Camera setup
    useEffect(() => {
        const startCamera = async () => {
            const videoEnabled = localStorage.getItem('video_enabled') === 'true';
            if (!videoEnabled) {
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };

        startCamera();
        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Add this at the start of the component
    useEffect(() => {
        // Redirect if trying to access directly without setup
        if (!localStorage.getItem('interview_user_id')) {
            router.push('/services');
            return;
        }
    }, [router]);

    // Add timer check interval
    useEffect(() => {
        const checkInterviewTime = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/check-interview-time`, {
                    headers: {
                        'Authorization': `Bearer ${session.backendToken}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (!data.should_continue && !isTimeUp) {
                        setIsTimeUp(true);
                        // Add final message from interviewer
                        setMessages(prev => [...prev, {
                            role: 'interviewer',
                            content: "Thank you for your time. This concludes our interview session."
                        }]);
                        // Clean up interview
                        if (wsRef.current) {
                            wsRef.current.close();
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking interview time:', error);
            }
        };

        // Check every 30 seconds
        const intervalId = setInterval(checkInterviewTime, 30000);

        return () => {
            clearInterval(intervalId);
        };
    }, [session, isTimeUp]);

    useEffect(() => {
        // Check camera preference from localStorage
        const cameraEnabled = localStorage.getItem('cameraEnabled') === 'true';
        setIsCameraEnabled(cameraEnabled);
    }, []);

    const handleUserInput = async (text) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setError('Not connected to interview. Please refresh.');
            return;
        }

        setMessages(prev => [...prev, {
            role: 'user',
            content: text
        }]);

        setShowRecordingPrompt(false);
        wsRef.current.send(text);
    };

    // Update active speaker logic
    const isActiveSpeaker = (speaker) => {
        if (speaker === 'interviewer') {
            return isInterviewerTurn || currentlyPlaying || pendingMessages.length > 0;
        }
        return !isInterviewerTurn && !currentlyPlaying && pendingMessages.length === 0;
    };

    if (status === 'loading') {
        return (
            <div className={styles.loading}>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.mainContent}>
                {/* Camera Container */}
                <div className={`${styles.cameraContainer} ${isActiveSpeaker('user') ? styles.activeSpeaker : ''}`}>
                    <Camera enabled={isCameraEnabled} />
                </div>

                {/* Interviewer Box */}
                <div className={`${styles.interviewerBox} ${isActiveSpeaker('interviewer') ? styles.activeSpeaker : ''}`}>
                    <Image
                        src="/images/NoahPhoto.jpg"
                        alt="AI Interviewer"
                        width={160}
                        height={160}
                        className={styles.interviewerImage}
                    />
                    <div className={styles.interviewerOverlay}>Noah</div>
                </div>

                {/* Chat Interface */}
                <div className={styles.interviewContainer}>
                    <div className={styles.header}>
                        Live Transcript
                        {showRecordingPrompt && (
                            <div className={styles.recordingStatus}>
                                Press Space or Enter when done speaking
                            </div>
                        )}
                    </div>

                    <div className={styles.chatBox} ref={chatBoxRef}>
                        <div className={styles.messagesWrapper}>
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`${styles.message} ${
                                        msg.role === 'interviewer' ? styles.interviewer : styles.user
                                    }`}
                                >
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                    </div>

                    {showKeyHint && (
                        <div className={styles.keyHint}>
                            End response <span className={styles.keySymbol}>⎵</span> or <span className={styles.keySymbol}>↵</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Interview;