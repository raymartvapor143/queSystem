import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

// Hardcoded SERVICE_CATEGORIES removed. Categories are now derived dynamically from database counters.

let syncChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('queue_sync_channel');
    syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'REFRESH_QUEUE') {
            useQueueStore.getState().fetchQueueState();
        }
    };
}

const broadcastSync = () => {
    if (syncChannel) {
        syncChannel.postMessage({ type: 'REFRESH_QUEUE' });
    }
};

const useQueueStore = create(
    persist(
        (set, get) => ({
            queue: [],
            currentQueue: null,
            servingQueues: [],
            counters: [
                { id: 1, name: 'Counter 1', staff: 'Procurement Officer' },
                { id: 2, name: 'Counter 2', staff: 'Assistant Officer' },
                { id: 3, name: 'Counter 3', staff: 'Senior Officer' },
            ],
            activeCounter: 1,
            lastTicketNumber: 0,
            completedQueues: [],
            statistics: {
                totalServed: 0,
                totalSkipped: 0,
                averageWaitTime: 0,
            },
            soundEnabled: true,
            voiceEnabled: true,
            lastCalledTrigger: null,

            isFetching: false,
            toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
            toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

            fetchQueueState: async () => {
                if (get().isFetching) return;
                set({ isFetching: true });
                try {
                    const res = await axios.get('/api/queue');
                    if (res.data) {
                        const currentVal = get().currentQueue;
                        const newVal = res.data.currentQueue;
                        const oldServing = get().servingQueues || [];
                        const newServing = res.data.servingQueues || (newVal ? [newVal] : []);

                        let trigger = get().lastCalledTrigger;
                        // Check if any ticket in new serving queues is new or has been recalled/re-served
                        const hasNewCall = newServing.some((nt) => {
                            const match = oldServing.find((ot) => ot.id === nt.id);
                            if (!match) return true;
                            return match.recalledAt !== nt.recalledAt || match.servedAt !== nt.servedAt;
                        });

                        if (hasNewCall || (newVal && (!currentVal || currentVal.id !== newVal.id))) {
                            trigger = Date.now();
                        }

                        const state = get();
                        const newQueue = res.data.queue || [];
                        const newCounters = res.data.counters || state.counters;
                        const newLastNumber = res.data.lastTicketNumber || 0;
                        const newCompleted = res.data.completedQueues || [];
                        const newStats = res.data.statistics || state.statistics;

                        // Deep string check to eliminate redundant React re-renders
                        const queueChanged = JSON.stringify(state.queue) !== JSON.stringify(newQueue);
                        const servingChanged = JSON.stringify(state.servingQueues) !== JSON.stringify(newServing);
                        const countersChanged = JSON.stringify(state.counters) !== JSON.stringify(newCounters);
                        const statsChanged = JSON.stringify(state.statistics) !== JSON.stringify(newStats);
                        const triggerChanged = state.lastCalledTrigger !== trigger;

                        if (queueChanged || servingChanged || countersChanged || statsChanged || triggerChanged) {
                            set({
                                queue: newQueue,
                                currentQueue: newVal || null,
                                servingQueues: newServing,
                                counters: newCounters,
                                activeCounter: res.data.activeCounter || 1,
                                lastTicketNumber: newLastNumber,
                                completedQueues: newCompleted,
                                statistics: newStats,
                                lastCalledTrigger: trigger,
                            });
                        }
                    }
                } catch (err) {
                    console.warn('API sync error:', err);
                } finally {
                    set({ isFetching: false });
                }
            },

            generateTicket: async (categoryId = 'GEN') => {
                let category = null;
                const counterId = String(categoryId).startsWith('CTR-')
                    ? parseInt(String(categoryId).replace('CTR-', ''), 10)
                    : parseInt(categoryId, 10);

                const foundCounter = (get().counters || []).find(c => c.id === counterId);
                if (foundCounter) {
                    category = {
                        id: `CTR-${foundCounter.id}`,
                        name: foundCounter.name,
                        prefix: (foundCounter.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 3) || 'CTR').toUpperCase(),
                    };
                }

                if (!category) {
                    const firstCounter = (get().counters || [])[0];
                    if (firstCounter) {
                        category = {
                            id: `CTR-${firstCounter.id}`,
                            name: firstCounter.name,
                            prefix: (firstCounter.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 3) || 'CTR').toUpperCase(),
                        };
                    } else {
                        category = {
                            id: 'GEN',
                            name: 'General Counter',
                            prefix: 'GEN',
                        };
                    }
                }
                const tempTicket = {
                    id: Date.now(),
                    number: `${category.prefix}-...`,
                    category: category.name,
                    categoryId: category.id,
                    createdAt: new Date().toISOString(),
                    status: 'pending',
                };

                try {
                    const res = await axios.post('/api/queue/generate', { categoryId });
                    if (res.data && res.data.ticket) {
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data.ticket;
                    }
                } catch (err) {
                    console.warn('Generate ticket API error, using local fallback:', err);
                }

                const { lastTicketNumber, queue } = get();
                const newNumber = lastTicketNumber + 1;
                const ticketNumber = `${category.prefix}-${String(newNumber).padStart(3, '0')}`;
                const newTicket = { ...tempTicket, number: ticketNumber };
                set({
                    queue: [...queue, newTicket],
                    lastTicketNumber: newNumber,
                });
                broadcastSync();
                return newTicket;
            },

            nextQueue: async (counterId) => {
                try {
                    const res = await axios.post('/api/queue/next', { counterId });
                    if (res.data && res.data.currentQueue) {
                        set({ lastCalledTrigger: Date.now() });
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data.currentQueue;
                    }
                } catch (err) {
                    console.warn('Next queue API error:', err);
                }
                return null;
            },

            callBatchTickets: async (ticketIds, counterId) => {
                try {
                    const res = await axios.post('/api/queue/call-batch', { ticketIds, counterId });
                    if (res.data) {
                        set({ lastCalledTrigger: Date.now() });
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data.servingTickets;
                    }
                } catch (err) {
                    console.warn('Batch call API error:', err);
                }
                return null;
            },

            recallQueue: async (counterId) => {
                try {
                    const res = await axios.post('/api/queue/recall', { counterId });
                    if (res.data) {
                        set({ lastCalledTrigger: Date.now() });
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data.currentQueue;
                    }
                } catch (err) {
                    console.warn('Recall API error:', err);
                }
                return null;
            },

            skipQueue: async (counterId) => {
                try {
                    const res = await axios.post('/api/queue/skip', { counterId });
                    if (res.data) {
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data;
                    }
                } catch (err) {
                    console.warn('Skip API error:', err);
                }
                return null;
            },

            completeQueue: async (counterId) => {
                try {
                    const res = await axios.post('/api/queue/complete', { counterId });
                    if (res.data) {
                        await get().fetchQueueState();
                        broadcastSync();
                        return res.data;
                    }
                } catch (err) {
                    console.warn('Complete API error:', err);
                }
                return null;
            },

            resetQueue: async () => {
                try {
                    await axios.post('/api/queue/reset');
                    await get().fetchQueueState();
                    broadcastSync();
                } catch (err) {
                    console.warn('Reset API error:', err);
                }
            },

            addCounter: async (name, staff) => {
                try {
                    const res = await axios.post('/api/counters', { name, staff });
                    if (res.data && res.data.counters) {
                        set({ counters: res.data.counters });
                        broadcastSync();
                    }
                } catch (err) {
                    console.warn('Add counter API error:', err);
                }
            },

            updateCounter: async (counterId, staffName, counterName) => {
                try {
                    const res = await axios.put(`/api/counters/${counterId}`, { staffName, name: counterName });
                    if (res.data && res.data.counters) {
                        set({ counters: res.data.counters });
                        broadcastSync();
                    }
                } catch (err) {
                    console.warn('Update counter API error:', err);
                }
            },

            removeCounter: async (counterId) => {
                try {
                    const res = await axios.delete(`/api/counters/${counterId}`);
                    if (res.data && res.data.counters) {
                        set({ counters: res.data.counters });
                        broadcastSync();
                    }
                } catch (err) {
                    console.warn('Remove counter API error:', err);
                }
            },

            setActiveCounter: (counterId) => {
                set({ activeCounter: counterId });
            },
        }),
        {
            name: 'queue-storage',
            partialize: (state) => ({
                soundEnabled: state.soundEnabled,
                voiceEnabled: state.voiceEnabled,
                activeCounter: state.activeCounter,
            }),
        }
    )
);

// Initial fetch on application boot
if (typeof window !== 'undefined') {
    useQueueStore.getState().fetchQueueState();
}

export default useQueueStore;