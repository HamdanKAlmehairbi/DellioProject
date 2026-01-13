import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import styles from '../styles/WaitingRoom.module.css';

const WaitingRoom = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const [queuePosition, setQueuePosition] = useState(null);
    const [activeUsers, setActiveUsers] = useState(0);
    const [maxUsers, setMaxUsers] = useState(5);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/queue-status`, {
                    headers: {
                        'Authorization': `Bearer ${session.backendToken}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setQueuePosition(data.queue_position);
                    setActiveUsers(data.active_users);
                    setMaxUsers(data.max_users);

                    // If position is -1, we're not in queue, try to join
                    if (data.queue_position === -1) {
                        const joinResponse = await fetch(
                            `${process.env.NEXT_PUBLIC_BACKEND_URL}/join-interview-queue`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${session.backendToken}`
                                }
                            }
                        );

                        if (joinResponse.ok) {
                            const joinData = await joinResponse.json();
                            if (joinData.status === 'active') {
                                router.push('/setup');
                            } else {
                                setQueuePosition(joinData.position);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking queue status:', error);
            }
        };

        const intervalId = setInterval(checkStatus, 5000);
        checkStatus(); // Initial check

        return () => clearInterval(intervalId);
    }, [session, router]);

    return (
        <div className={styles.waitingRoom}>
            <h1>Interview Waiting Room</h1>
            <div className={styles.status}>
                <p>Active Users: {activeUsers}/{maxUsers}</p>
                {queuePosition !== null && queuePosition >= 0 && (
                    <div className={styles.queueInfo}>
                        <p>Your position in queue: {queuePosition + 1}</p>
                        <div className={styles.estimatedTime}>
                            Estimated wait time: ~{queuePosition * 10} minutes
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaitingRoom; 