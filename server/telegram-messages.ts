/** Serialize competing result updates and remember the last acknowledged text. */
export function telegramMessageUpdater(edit: (chat: string, message: number, text: string) => Promise<unknown>) {
    const messages = new Map<string, { pending: Promise<void>; text?: string }>();
    return (chat: string, message: number, text: string): Promise<void> => {
        const key = `${chat}:${message}`;
        let state = messages.get(key);
        if (!state) {
            state = { pending: Promise.resolve() };
            messages.set(key, state);
        }
        const current = state;
        const task = current.pending.catch(() => {}).then(async () => {
            if (current.text === text) return;
            try { await edit(chat, message, text); }
            catch (error) {
                const telegram = error as { error_code?: number; description?: string };
                // An already-applied edit is success, including after a server restart.
                if (telegram.error_code !== 400 || !telegram.description?.includes('message is not modified')) throw error;
            }
            current.text = text;
        });
        current.pending = task;
        return task;
    };
}
