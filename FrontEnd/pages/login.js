import React, { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import Header from "../components/Header";
import styles from "../styles/Login.module.css";
import LoadingAnimation from '../components/LoadingAnimation';
import { useRouter } from "next/router";

const Login = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { callbackUrl, error } = router.query;
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log('Login Page - Session:', session);
        console.log('Login Page - Status:', status);

        if (session?.backendToken) {
            console.log('Login Page - Redirecting to services...');
            router.push('/services');
        }
    }, [session, router]);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            console.log('Initiating Google Sign In...');
            await signIn('google', {
                callbackUrl: '/services',
                redirect: true
            });
        } catch (error) {
            console.error('Sign in error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading" || loading) {
        return <LoadingAnimation />;
    }

    return (
        <div>
            <Header />
            <div className={styles.container}>
                {!session && (
                    <div className={styles.loginBox}>
                        <h2 className={styles.title}>Welcome to InterviewAI</h2>
                        <p className={styles.subText}>Sign in to start your interview preparation</p>
                        <button
                            onClick={handleGoogleSignIn}
                            className={styles.googleButton}
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign in with Google'}
                        </button>
                        {error && (
                            <p className={styles.errorText}>
                                {error === 'SessionRequired' 
                                    ? 'Please sign in to access this page' 
                                    : 'Authentication error. Please try again.'}
                            </p>
                        )}
                    </div>
                )}
                {session && (
                    <div className={styles.loginBox}>
                        <h2 className={styles.title}>Welcome Back!</h2>
                        <p className={styles.subText}>Redirecting you to the services page...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;