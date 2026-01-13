import WaitingRoom from '../components/WaitingRoom';
import LoadingAnimation from '../components/LoadingAnimation';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const WaitingRoomPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        // Redirect if not authenticated
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        // Redirect if no interview_user_id
        if (!localStorage.getItem('interview_user_id')) {
            router.push('/services');
            return;
        }
    }, [status, router]);

    if (status === 'loading') {
        return <LoadingAnimation />;
    }

    if (!session) {
        return null;
    }

    return <WaitingRoom />;
};

export default WaitingRoomPage; 