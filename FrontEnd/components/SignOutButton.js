import Link from 'next/link';
import { signOut } from 'next-auth/react';
import styles from '../styles/Home.module.css';

const SignOutButton = () => {
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    sessionStorage.clear();
    document.cookie = 'refreshToken=; Max-Age=0; path=/;';
    window.location.href = '/login';
  };

  return (
    <Link href="#" className={styles.signoutstyle} onClick={handleSignOut}>
      Sign Out from Google
    </Link>
  );
};

export default SignOutButton;