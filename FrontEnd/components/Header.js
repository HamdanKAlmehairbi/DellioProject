import { signIn, signOut, useSession } from "next-auth/react";
import Link from 'next/link';
import styles from "../styles/Home.module.css";

const Header = () => {
    const { data: session, status } = useSession(); // Include `status` to handle loading state

    return (
        <header className={styles.stickyHeader}>
            <nav className={styles.navBar}>
                <Link href="/" className={styles.logo}>
                    Delli<span className={styles.highlightO}>o</span>
                </Link>
                <ul className={styles.navLinks}>
                    <li>
                        <Link href="/" className={styles.navLink}>
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link href="/services" className={styles.navLink}>
                            Services
                        </Link>
                    </li>
                    <li>
                        <Link href="/contact" className={styles.navLink}>
                            Contact
                        </Link>
                    </li>
                </ul>
                <div className={styles.navButtons}>
                    {status === "loading" ? ( // Show placeholder while session is loading
                        <div className={styles.placeholder}>
                            {/* Optional placeholder styling */}
                        </div>
                    ) : session ? (
                        <>
                            <button
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className={styles.loginButton}
                                aria-label="Sign out of your account"
                            >
                                Sign Out
                            </button>
                            <Link
                                href="/services"
                                className={styles.getStartedButton}
                                aria-label="Get started with our services"
                            >
                                Get Started
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className={styles.loginButton}
                                aria-label="Log in to your account"
                            >
                                Login
                            </Link>
                            <Link
                                href="/services"
                                className={styles.getStartedButton}
                                aria-label="Get started with our services"
                            >
                                Get Started
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default Header;