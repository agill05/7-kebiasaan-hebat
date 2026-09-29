function useOnlineSyncEngine() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncStatus, setSyncStatus] = useState('idle');
    const isSyncingRef = useRef(false);

    const pushOnly = useCallback(async () => {
        if (!navigator.onLine || !GAS_API_URL || GAS_API_URL.includes("MASUKKAN_URL")) return;
        setSyncStatus('syncing');
        try {
            await pushPendingQueue();
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 2500);
        }
    }, []);

    const fullSynchronize = useCallback(async (isImmediatePush = true) => {
        if (!navigator.onLine || !GAS_API_URL || GAS_API_URL.includes("MASUKKAN_URL")) return;
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        setSyncStatus('syncing');

        try {
            if (isImmediatePush) {
                await pushPendingQueue();
                await new Promise(res => setTimeout(res, 800));
            }
            await pullAllCloudData();
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 2500);
        } finally {
            isSyncingRef.current = false;
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); fullSynchronize(true); };
        const handleOffline = () => { setIsOnline(false); setSyncStatus('idle'); };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const interval = setInterval(() => {
            if (navigator.onLine && !isSyncingRef.current) fullSynchronize(true);
        }, 60000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [fullSynchronize]);

    return {
        isOnline,
        syncStatus,
        triggerSync: pushOnly,
        triggerManualPull: () => fullSynchronize(false)
    };
}
