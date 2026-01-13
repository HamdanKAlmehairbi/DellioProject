import React from 'react';
import styles from '../styles/Home.module.css'; // Ensure this points to your correct CSS file

const Footer = () => {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.footerLogo}>
                    Delli<span className={styles.highlightO}>o</span>
                    <span className={styles.copyright}>©</span>
                </div>
                <span className={styles.footerText}>| All Rights Reserved 2025</span>
            </div>
        </footer>
    );
};

export default Footer;
