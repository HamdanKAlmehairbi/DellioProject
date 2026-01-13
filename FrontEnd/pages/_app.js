import { SessionProvider } from "next-auth/react";
import '../styles/globals.css'; // Import global CSS here

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
    return (
        <SessionProvider session={session}>
            <Component {...pageProps} />
        </SessionProvider>
    );
}

export default MyApp;
