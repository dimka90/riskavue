import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telegram, Pairing } from '../server/integrations.ts';
import { config } from '../server/config.ts';
import { Service } from '../server/service.ts';
import { Store } from '../server/store.ts';
import { Paper } from '../server/exchange.ts';

test('Telegram /lock and rapid double-confirm produce one lock and never expose unchanged-message errors', async () => {
    const original = { telegram: config.telegram, owner: config.owner };
    config.telegram = '123456:offline-test'; config.owner = '123';
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    const sent: string[] = [], edited: string[] = [];
    try {
        await service.refresh();
        const bot = telegram(service, new Pairing(service), false)!;
        bot.botInfo = { id: 123456, is_bot: true, first_name: 'Riskavue', username: 'RiskavueBot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as typeof bot.botInfo;
        bot.api.config.use(async (_prev, method, payload: any) => {
            if (method === 'editMessageText') {
                edited.push(payload.text);
                return { ok: false, error_code: 400, description: 'Bad Request: message is not modified' } as any;
            }
            if (method === 'sendMessage') sent.push(payload.text);
            return { ok: true, result: method === 'sendMessage' ? { message_id: 7, chat: { id: 123, type: 'private' }, date: 0, text: payload.text } : true } as any;
        });
        const from = { id: 123, is_bot: false, first_name: 'Owner' };
        await bot.handleUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat: { id: 123, type: 'private', first_name: 'Owner' }, from, text: '/lock', entities: [{ type: 'bot_command', offset: 0, length: 5 }] } });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(service.lock, null);
        assert.match(sent[0], /Lock new trades through Riskavue until 00:00 UTC\?/);
        assert.doesNotMatch(sent[0], /stops kept|SESSION LOCKED/);
        const action = store.actions()[0];
        const update = (id: number): any => ({ update_id: id, callback_query: { id: String(id), from, chat_instance: 'offline', data: `yes:${action.id}`, message: { message_id: 7, date: 0, chat: { id: 123, type: 'private' } } } });
        await Promise.all([bot.handleUpdate(update(2)), bot.handleUpdate(update(3))]);
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(service.lock);
        assert.equal(store.decisions().filter(d => d.kind === 'lock').length, 1);
        assert.equal(edited.length, 1);
        assert.match(edited[0], /^LOCKED/);
        assert.doesNotMatch(edited[0], /\?/);
        assert.equal(sent.length, 1, 'No raw error or duplicate result is sent');
    } finally { Object.assign(config, original); store.close(); }
});
