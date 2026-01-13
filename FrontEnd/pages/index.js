import React from 'react';
import Header from '../components/Header'; // Import the updated Header component
import Footer from '../components/Footer'; // Add this import
import styles from '../styles/Home.module.css';
import { useRouter } from 'next/router';

const Home = () => {
    const router = useRouter();

    const handleTryClick = () => {
        router.push('/services');
    };

    return (
        <div>
            <Header /> {/* Use the centralized Header component */}
            <div className={styles.mainContainer}>
                <div className="dmContent">
                    <h1 className={styles.headerText}>
                        Practice <span className={styles.highlightText}>efficiently.</span>
                    </h1>
                    <h1 className={styles.headerText}>
                        Interview with <span className={styles.highlightText}>confidence.</span>
                    </h1>
                    <p className={styles.subHeader}>
                        Boost your preparation plan with an enhanced AI interviewer,
                    </p>
                    <p className={styles.subHeader}>
                        get an edge over the competition.
                    </p>
                    <button 
                        onClick={handleTryClick}
                        className={styles.tryButton}
                    >
                        Try Dellio
                    </button>
                </div>
            </div>
            <Footer /> {/* Replace the old footer HTML with the Footer component */}
        </div>
    );
};

export default Home;
