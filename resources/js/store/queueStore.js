import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export const SERVICE_CATEGORIES = [
    { id: 'CON', name: 'Contracting Division', prefix: 'CON', icon: '📄', desc: 'Contracts, Bidding & Sealed Submissions' },
    { id: 'PR', name: 'PR Division', prefix: 'PR', icon: '📋', desc: 'Purchase Requisitions & Procurement Processing' },
    { id: 'TEC', name: 'Technical Division', prefix: 'TEC', icon: '⚙️', desc: 'Technical Specifications & Product Inspection' },
    { id: 'ADM', name: 'Admin Division', prefix: 'ADM', icon: '🏢', desc: 'Administrative Services & General Assistance' },
];

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

            toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
            toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

            fetchQueueState: async () => {
                try {
                    const res = await axios.get('/api/queue');
                    if (res.data) {
                        const currentVal = get().currentQueue;
                        const newVal = res.data.currentQueue;

                        let trigger = get().lastCalledTrigger;
                        if (
                            newVal &&
                            (!currentVal ||
                                currentVal.id !== newVal.id ||
                                currentVal.recalledAt !== newVal.recalledAt)
                        ) {
                            trigger = Date.now();
                        }

                        set({
                            queue: res.data.queue || [],
                            currentQueue: newVal || null,
                            servingQueues: res.data.servingQueues || (newVal ? [newVal] : []),
                            counters: res.data.counters || get().counters,
                            activeCounter: res.data.activeCounter || 1,
                            lastTicketNumber: res.data.lastTicketNumber || 0,
                            completedQueues: res.data.completedQueues || [],
                            statistics: res.data.statistics || get().statistics,
                            lastCalledTrigger: trigger,
                        });
                    }
                } catch (err) {
                    console.warn('API sync error:', err);
                }
            },

            generateTicket: async (categoryId = 'GEN') => {
                const category = SERVICE_CATEGORIES.find(c => c.id === categoryId) || SERVICE_CATEGORIES[3];
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
                return newTicket;
            },

            nextQueue: async (counterId) => {
                try {
                    const res = await axios.post('/api/queue/next', { counterId });
                    if (res.data && res.data.currentQueue) {
                        await get().fetchQueueState();
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
                        return res.data.servingTickets;
                    }
                } catch (err) {
                    console.warn('Batch call API error:', err);
                }
                return null;
            },

            recallQueue: async () => {
                try {
                    const res = await axios.post('/api/queue/recall');
                    if (res.data && res.data.currentQueue) {
                        await get().fetchQueueState();
                        return res.data.currentQueue;
                    }
                } catch (err) {
                    console.warn('Recall API error:', err);
                }
                return null;
            },

            skipQueue: async () => {
                try {
                    const res = await axios.post('/api/queue/skip');
                    if (res.data) {
                        await get().fetchQueueState();
                        return res.data.skippedTicket;
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
                } catch (err) {
                    console.warn('Reset API error:', err);
                }
            },

            addCounter: async (name, staff) => {
                try {
                    const res = await axios.post('/api/counters', { name, staff });
                    if (res.data && res.data.counters) {
                        set({ counters: res.data.counters });
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
        }
    )
);

if (typeof window !== 'undefined') {
    useQueueStore.getState().fetchQueueState();
    setInterval(() => {
        useQueueStore.getState().fetchQueueState();
    }, 3000);

    window.addEventListener('storage', (e) => {
        if (e.key === 'queue-storage') {
            useQueueStore.persist.rehydrate();
        }
    });
}

export default useQueueStore;