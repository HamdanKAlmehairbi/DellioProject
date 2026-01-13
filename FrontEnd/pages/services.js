import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import styles from '../styles/Services.module.css';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, getSession, signIn } from 'next-auth/react';
import LoadingAnimation from '../components/LoadingAnimation';


const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const checkBackendHealth = async (backendUrl) => {
    try {
        console.log('Checking backend health at:', backendUrl);
        const response = await fetch(`${backendUrl}/health`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'  // Prevent caching
            }
        });
        
        if (!response.ok) {
            console.error('Backend health check failed:', response.status);
            return false;
        }
        
        const data = await response.json();
        return data.status === 'healthy';
    } catch (error) {
        console.error('Backend health check error:', error);
        return false;
    }
};

const Services = () => {
    const [showUpload, setShowUpload] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { data: session, status, update } = useSession();
    const router = useRouter();

    // Document states
    const [resumeType, setResumeType] = useState('text');
    const [jobDescType, setJobDescType] = useState('text');
    const [resumeText, setResumeText] = useState('');
    const [jobDescText, setJobDescText] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [jobDescFile, setJobDescFile] = useState(null);
    const [resumeFileName, setResumeFileName] = useState('');
    const [jobDescFileName, setJobDescFileName] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isCheckingQueue, setIsCheckingQueue] = useState(false);

    // Check if the required fields are provided based on the selected input method
    const resumeProvided = resumeType === 'text' ? resumeText.trim().length > 0 : resumeFile !== null;
    const jobDescProvided = jobDescType === 'text' ? jobDescText.trim().length > 0 : jobDescFile !== null;
    const isSubmitDisabled = isLoading || !resumeProvided || !jobDescProvided || !acceptedTerms;

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const handleFileUpload = (event, type) => {
        const file = event.target.files[0];
        if (file) {
            if (
                file.type === 'application/pdf' ||
                file.type === 'text/plain' ||
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
                if (type === 'resume') {
                    setResumeFile(file);
                    setResumeFileName(file.name);
                } else {
                    setJobDescFile(file);
                    setJobDescFileName(file.name);
                }
            } else {
                setError('Please upload a PDF, DOCX, or text file');
            }
        }
    };

    const processFile = async (file) => {
        if (!file) return null;
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/process-documents`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.backendToken}` },
            body: formData
        });
        if (!response.ok) {
            throw new Error('Failed to process file');
        }
        const { text } = await response.json();
        return text;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (!session) {
            setError('Please sign in to continue');
            setIsLoading(false);
            return;
        }

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
            let currentToken = session.backendToken;
            
            console.log('Current session:', {
                hasBackendToken: !!session.backendToken,
                hasRefreshToken: !!session.refreshToken
            });

            // Only try to refresh if we have a refresh token but no access token
            if (!currentToken && session.refreshToken) {
                console.log('Attempting to refresh token...');
                try {
                    const refreshResponse = await fetch(`${backendUrl}/refresh-token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            refresh_token: session.refreshToken
                        })
                    });

                    const responseData = await refreshResponse.json();
                    console.log('Refresh response:', responseData);

                    if (refreshResponse.ok && responseData.access_token) {
                        // Update the session
                        await update({
                            ...session,
                            backendToken: responseData.access_token,
                            refreshToken: responseData.refresh_token || session.refreshToken
                        });
                        currentToken = responseData.access_token;
                        console.log('Token refreshed successfully');
                    } else {
                        console.error('Token refresh failed:', responseData);
                        if (refreshResponse.status === 401) {
                            await signIn('google', { callbackUrl: '/services', redirect: true });
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Token refresh error:', error);
                    if (error.message.includes('401')) {
                        await signIn('google', { callbackUrl: '/services', redirect: true });
                        return;
                    }
                }
            }

            // If we still don't have a token after refresh attempt
            if (!currentToken) {
                console.error('No valid token available');
                await signIn('google', { callbackUrl: '/services', redirect: true });
                return;
            }

            console.log('Submitting documents with token:', !!currentToken);
            
            // Process documents
            let resumeContent = resumeType === 'text' ? resumeText : await processFile(resumeFile);
            let jobDescContent = jobDescType === 'text' ? jobDescText : await processFile(jobDescFile);
            
            if (!resumeContent || !jobDescContent) {
                throw new Error('Both resume and job description are required');
            }

            // First check queue status
            const queueResponse = await fetch(`${backendUrl}/queue-status`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (!queueResponse.ok) {
                throw new Error('Failed to check queue status');
            }

            const queueData = await queueResponse.json();
            const hasSpace = queueData.active_users < queueData.max_users;

            // Process documents
            const response = await fetch(`${backendUrl}/process-documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                    resume: resumeContent,
                    job_description: jobDescContent
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                if (response.status === 401) {
                    console.error('Authentication failed:', errorData);
                    await signIn('google', { callbackUrl: '/services', redirect: true });
                    return;
                }
                throw new Error(`Failed to process documents: ${errorData}`);
            }

            const data = await response.json();
            if (data.user_id) {
                localStorage.setItem('interview_user_id', data.user_id);
                // If there's space, go directly to setup
                if (hasSpace) {
                    router.push('/setup');
                } else {
                    router.push('/waiting-room');
                }
            } else {
                throw new Error('No user ID received from server');
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message || 'An error occurred while processing documents');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingAnimation />;
    }

    return (
        <div>
            <Header />
            <div className={styles.container}>
                {error && <div className={styles.error}>{error}</div>}
                {!showUpload ? (
                    <div className={styles.tutorialBox}>
                        <h2 className={styles.tutorialTitle}>Start Your AI-Powered Interview</h2>
                        <div className={styles.tutorialSteps}>
                            <div className={styles.step}>
                                <div className={`${styles.stepIcon} ${styles.documentIcon}`}></div>
                                <h3>1. Prepare Documents</h3>
                                <p>Have your resume and target job description ready for AI analysis</p>
                            </div>
                            <div className={styles.step}>
                                <div className={`${styles.stepIcon} ${styles.micIcon}`}></div>
                                <h3>2. Practice Interview</h3>
                                <p>Conduct a personalized mock interview with our AI interviewer</p>
                            </div>
                        </div>
                        <button 
                            className={styles.getStartedButton}
                            onClick={() => setShowUpload(true)}
                        >
                            Get Started
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.formContainer}>
                        {/* Resume Section */}
                        <div className={styles.documentSection}>
                            <h3>Resume</h3>
                            <div className={styles.inputToggle}>
                                <button
                                    type="button"
                                    className={`${styles.toggleButton} ${resumeType === 'text' ? styles.active : ''}`}
                                    onClick={() => setResumeType('text')}
                                >
                                    Paste Text
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.toggleButton} ${resumeType === 'file' ? styles.active : ''}`}
                                    onClick={() => setResumeType('file')}
                                >
                                    Upload File
                                </button>
                            </div>
                            {resumeType === 'text' ? (
                                <textarea
                                    className={styles.textArea}
                                    value={resumeText}
                                    onChange={(e) => setResumeText(e.target.value)}
                                    placeholder="Paste your resume here..."
                                />
                            ) : (
                                <div className={styles.fileUpload}>
                                    <label className={styles.uploadButton}>
                                        <input
                                            type="file"
                                            accept=".pdf,.txt,.docx"
                                            onChange={(e) => handleFileUpload(e, 'resume')}
                                            style={{ display: 'none' }}
                                        />
                                        <div className={styles.uploadIcon}>📎</div>
                                        <span>Click to upload or drag and drop</span>
                                        <span className={styles.fileTypes}>PDF, DOCX, or TXT files only</span>
                                    </label>
                                    {resumeFileName && <div className={styles.fileName}>{resumeFileName}</div>}
                                </div>
                            )}
                        </div>

                        {/* Job Description Section */}
                        <div className={styles.documentSection}>
                            <h3>Job Description</h3>
                            <div className={styles.inputToggle}>
                                <button
                                    type="button"
                                    className={`${styles.toggleButton} ${jobDescType === 'text' ? styles.active : ''}`}
                                    onClick={() => setJobDescType('text')}
                                >
                                    Paste Text
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.toggleButton} ${jobDescType === 'file' ? styles.active : ''}`}
                                    onClick={() => setJobDescType('file')}
                                >
                                    Upload File
                                </button>
                            </div>
                            {jobDescType === 'text' ? (
                                <textarea
                                    className={styles.textArea}
                                    value={jobDescText}
                                    onChange={(e) => setJobDescText(e.target.value)}
                                    placeholder="Paste the job description here..."
                                />
                            ) : (
                                <div className={styles.fileUpload}>
                                    <label className={styles.uploadButton}>
                                        <input
                                            type="file"
                                            accept=".pdf,.txt,.docx"
                                            onChange={(e) => handleFileUpload(e, 'jobDesc')}
                                            style={{ display: 'none' }}
                                        />
                                        <div className={styles.uploadIcon}>📎</div>
                                        <span>Click to upload or drag and drop</span>
                                        <span className={styles.fileTypes}>PDF, DOCX, or TXT files only</span>
                                    </label>
                                    {jobDescFileName && <div className={styles.fileName}>{jobDescFileName}</div>}
                                </div>
                            )}
                        </div>

                        {/* Terms Agreement */}
                        <div className={styles.termsContainer}>
                            <label className={styles.termsLabel}>
                                <input
                                    type="checkbox"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className={styles.termsCheckbox}
                                />
                                <span>I agree to the terms and conditions</span>
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            className={styles.submitButton}
                            disabled={isSubmitDisabled}
                        >
                            {isLoading ? 'Processing...' : 'Start Interview'}
                        </button>
                        
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={() => setShowUpload(false)}
                        >
                            Back
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Services;
