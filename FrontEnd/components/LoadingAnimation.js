import React, { useState, useEffect } from 'react';
import styles from '../styles/LoadingAnimation.module.css';

const LoadingAnimation = () => {
    const letters = ['D', 'e', 'l', 'l', 'i', 'o'];
    const [show, setShow] = useState(true);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setShow(prev => !prev);
        }, 3000); // Toggle every 3 seconds
        
        return () => clearInterval(interval);
    }, []);
    
    return (
        <div className={styles.loadingContainer}>
            <div className={`${styles.dellio} ${show ? styles.show : styles.hide}`}>
                {letters.map((letter, index) => (
                    <span key={index} className={styles.char}>
                        {letter}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default LoadingAnimation;
