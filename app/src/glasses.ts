import { waitForEvenAppBridge, TextContainerProperty, CreateStartUpPageContainer, TextContainerUpgrade, OsEventTypeList } from '@evenrealities/even_hub_sdk';
export async function glasses(onInput: (event: 'tap' | 'up' | 'down' | 'hold' | 'release' | 'active' | 'inactive') => void, onAudio: (bytes: Uint8Array) => void, onStatus: (s: string) => void) {
    const bridge = await waitForEvenAppBridge();
    const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [new TextContainerProperty({ xPosition: 12, yPosition: 8, width: 552, height: 272, borderWidth: 0, borderColor: 5, textColor: 4, paddingLength: 4, containerID: 1, containerName: 'riskavue', content: 'Riskavue\nYour limits. In sight.\nConnecting...', isEventCapture: 1 })] }));
    if (result !== 0)
        throw new Error(`G2 page rejected (${result})`);
    onStatus('G2 connected');
    let latest = '', sent = '', busy = false, active = true;
    const timer = setInterval(async () => { if (busy || !active || !latest || latest === sent)
        return; busy = true; const content = latest; try {
        const ok = await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'riskavue', content }));
        if (ok)
            sent = content;
        else
            onStatus('G2 update failed');
    }
    catch {
        onStatus('G2 disconnected');
    }
    finally {
        busy = false;
    } }, 500);
    const type = (event?: {
        eventType?: OsEventTypeList;
    }) => event ? event.eventType ?? OsEventTypeList.CLICK_EVENT : null;
    const unsubscribe = bridge.onEvenHubEvent(event => {
        if (event.audioEvent) {
            onAudio(event.audioEvent.audioPcm);
            return;
        }
        const types = [type(event.sysEvent), type(event.textEvent), type(event.listEvent)];
        if (types.includes(OsEventTypeList.DOUBLE_CLICK_EVENT)) {
            void bridge.shutDownPageContainer(1);
            return;
        }
        if (types.includes(OsEventTypeList.SYSTEM_EXIT_EVENT) || types.includes(OsEventTypeList.ABNORMAL_EXIT_EVENT)) {
            active = false;
            onInput('inactive');
            return;
        }
        if (types.includes(OsEventTypeList.FOREGROUND_EXIT_EVENT)) {
            active = false;
            onInput('inactive');
            return;
        }
        if (types.includes(OsEventTypeList.FOREGROUND_ENTER_EVENT)) {
            active = true;
            sent = '';
            onInput('active');
            return;
        }
        if (types.includes(OsEventTypeList.CLICK_EVENT))
            onInput('tap');
        else if (types.includes(OsEventTypeList.SCROLL_TOP_EVENT))
            onInput('up');
        else if (types.includes(OsEventTypeList.SCROLL_BOTTOM_EVENT))
            onInput('down');
        else if (types.includes(OsEventTypeList.LONG_PRESS_EVENT))
            onInput('hold');
        else if (types.includes(OsEventTypeList.LONG_PRESS_RELEASE_EVENT))
            onInput('release');
    });
    return { update: (text: string) => { latest = text; }, mic: (open: boolean) => bridge.audioControl(open), dispose: () => { clearInterval(timer); unsubscribe(); } };
}
