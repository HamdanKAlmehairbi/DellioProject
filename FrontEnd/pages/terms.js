import styles from '../styles/Terms.module.css';
import Link from 'next/link';

const TermsOfService = () => {
    return (
        <div className={styles.container}>
            <div className={styles.termsBox}>
                <h1 className={styles.title}>Terms of Service</h1>
                
                <div className={styles.effectiveDate}>
                    Effective: {new Date().toLocaleDateString()}
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
                    <p className={styles.text}>By accessing or using Dellio's AI Interview Practice Service ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Service Description</h2>
                    <p className={styles.text}>Dellio provides a free AI-powered mock interview service for practice purposes only. The Service uses artificial intelligence to simulate job interviews and provide feedback. This Service is for educational and practice purposes only and does not guarantee any specific outcomes in real interviews.</p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. User Responsibilities</h2>
                    <ul className={styles.termsList}>
                        <li>You must be at least 18 years old to use the Service</li>
                        <li>Provide accurate and truthful information</li>
                        <li>Do not submit any sensitive personal information (such as social security numbers, financial data, or protected health information)</li>
                        <li>Do not use the Service for any illegal or unauthorized purpose</li>
                        <li>Do not attempt to probe, scan, or test the vulnerability of the Service</li>
                        <li>Maintain the confidentiality of your account credentials</li>
                    </ul>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Data Usage and Privacy</h2>
                    <p className={styles.text}>By using the Service, you acknowledge and agree that:</p>
                    <ul className={styles.termsList}>
                        <li>Your uploaded documents (resume and job description) and interview responses are only used to provide you with the interview practice service</li>
                        <li>Your data is stored temporarily and is automatically deleted after a maximum period of 7 days</li>
                        <li>We do not sell, share, analyze, or use your data for any purpose other than providing the immediate interview service</li>
                        <li>Your data is not used to train or improve AI models</li>
                    </ul>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. AI Limitations and Disclaimer</h2>
                    <p className={styles.text}>You acknowledge and agree that:</p>
                    <ul className={styles.termsList}>
                        <li>The AI system may produce inaccurate, inappropriate, or biased content</li>
                        <li>The Service is not a substitute for professional career advice</li>
                        <li>Interview feedback and suggestions are for practice purposes only</li>
                        <li>We make no guarantees about the accuracy or reliability of AI-generated content</li>
                    </ul>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>6. Intellectual Property</h2>
                    <p className={styles.text}>All content, features, and functionality of the Service are owned by Dellio and are protected by international copyright, trademark, and other intellectual property rights. Users retain ownership of their uploaded content but grant us a limited license to use it for providing the Service.</p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>7. Limitation of Liability</h2>
                    <p className={styles.text}>To the maximum extent permitted by law:</p>
                    <ul className={styles.termsList}>
                        <li>The Service is provided "as is" without any warranties</li>
                        <li>We are not liable for any damages arising from your use of the Service</li>
                        <li>We are not responsible for actual interview outcomes or career decisions</li>
                        <li>Our total liability shall not exceed the amount you paid for the Service (which is zero as this is a free service)</li>
                    </ul>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>8. Indemnification</h2>
                    <p className={styles.text}>You agree to indemnify and hold harmless Dellio, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from your use of the Service or violation of these terms.</p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>9. Modifications to Service</h2>
                    <p className={styles.text}>We reserve the right to modify or discontinue the Service at any time without notice. We are not liable to you or any third party for any modification, suspension, or discontinuance of the Service.</p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>10. Governing Law</h2>
                    <p className={styles.text}>These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Dellio operates, without regard to its conflict of law provisions.</p>
                </div>

                <div className={styles.contactSection}>
                    <h3>Contact Information</h3>
                    <p className={styles.text}>For any questions about these Terms, please contact us at:</p>
                    <p className={styles.text}>Email: support@dellio.ai</p>
                </div>

                <Link href="/services" className={styles.backLink}>
                    ← Return to Services
                </Link>
            </div>
        </div>
    );
};

export default TermsOfService;