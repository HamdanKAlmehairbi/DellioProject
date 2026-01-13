import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// Helper function to get the correct backend URL
const getBackendUrl = () => {
    // When running server-side in Docker, use the service name
    if (typeof window === 'undefined') {
        return 'http://backend:8000';
    }
    // When running client-side, use the public URL
    return process.env.NEXT_PUBLIC_BACKEND_URL;
};

export const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        CredentialsProvider({
            id: "credentials",
            name: "Credentials",
            credentials: {},
            async authorize(credentials) {
                try {
                    // Return the session data as the user
                    return credentials;
                } catch (error) {
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, trigger, session }) {
            // Handle session update
            if (trigger === "update" && session) {
                console.log("Updating session in JWT callback:", session);
                return {
                    ...token,
                    backendToken: session.backendToken,
                    refreshToken: session.refreshToken
                };
            }

            // Initial sign in
            if (account && user) {
                try {
                    console.log('Generating backend token for user:', user.email);
                    const backendUrl = getBackendUrl();
                    console.log('Using backend URL:', backendUrl);
                    
                    const response = await fetch(`${backendUrl}/generate-token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            user_id: user.id || token.sub,
                            email: user.email
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to get backend token');
                    }

                    const data = await response.json();
                    console.log("Received backend tokens:", data);
                    return {
                        ...token,
                        backendToken: data.token.access_token,
                        refreshToken: data.token.refresh_token,
                    };
                } catch (error) {
                    console.error('Error getting backend token:', error);
                    throw error;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                console.log("Setting session from token:", {
                    backendToken: !!token.backendToken,
                    refreshToken: !!token.refreshToken
                });
                session.backendToken = token.backendToken;
                session.refreshToken = token.refreshToken;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login'
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: true, // Enable debug mode to see more logs
};

export default NextAuth(authOptions);