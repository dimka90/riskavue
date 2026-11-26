import { glassesMenu, menuInput } from './glasses-menu.ts';
import { valueColumn } from './display-layout.ts';
import { waitForEvenAppBridge, TextContainerProperty, CreateStartUpPageContainer, TextContainerUpgrade, OsEventTypeList, RebuildPageContainer, ImageContainerProperty, ImageRawDataUpdate, ImageRawDataUpdateResult } from '@evenrealities/even_hub_sdk';
export async function glasses(onInput: (event: 'tap' | 'up' | 'down' | 'hold' | 'release' | 'active' | 'inactive' | 'back' | 'actions') => void, onAudio: (bytes: Uint8Array) => void, onStatus: (s: string) => void) {
    const bridge = await waitForEvenAppBridge();
    const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ menuObject: glassesMenu(), containerTotalNum: 1, textObject: [new TextContainerProperty({ xPosition: 12, yPosition: 4, width: 552, height: 280, borderWidth: 0, borderColor: 5, textColor: 4, paddingLength: 4, containerID: 1, containerName: 'riskavue', content: 'Riskavue\nYour limits. In sight.\nConnecting...', isEventCapture: 1 })] }));
    if (result !== 0)
        throw new Error(`G2 page rejected (${result})`);
    onStatus('G2 connected');
    let latest = '', sent = '', busy = false, active = true, layout = '', baseSent = '', returningFromMenu = false;
    const textContainer = (content: string) => new TextContainerProperty({ xPosition: 12, yPosition: 4, width: 552, height: 280, borderWidth: 0, paddingLength: 4, containerID: 1, containerName: 'riskavue', content, isEventCapture: 1, textColor: 4, zOrderIndex: 0 });
    const timer = setInterval(async () => { if (busy || !active || !latest || latest === sent)
        return; busy = true; const content = latest; try {
        const nativeContent = content.replaceAll('-'.repeat(40), '-'.repeat(53));
        const column = valueColumn(nativeContent);
        let ok = true;
        if ((column?.key ?? '') !== layout) {
            ok = await bridge.rebuildPageContainer(new RebuildPageContainer({ menuObject: glassesMenu(), containerTotalNum: column ? 2 : 1, textObject: [textContainer(column?.content ?? nativeContent)], imageObject: column ? [new ImageContainerProperty({ xPosition: 320, yPosition: column.y, width: 240, height: column.height, containerID: 2, containerName: 'values', zOrderIndex: 1 })] : [] }));
            if (ok) { layout = column?.key ?? ''; baseSent = column?.content ?? nativeContent; }
        } else if (baseSent !== (column?.content ?? nativeContent)) {
            ok = await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'riskavue', content: column?.content ?? nativeContent }));
            if (ok) baseSent = column?.content ?? nativeContent;
        }
        if (ok && column) {
            ok = await bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 2, containerName: 'values', imageData: column.imageData })) === ImageRawDataUpdateResult.success;
            if (!ok) {
                // Keep every value readable if a host cannot render the image column.
                ok = await bridge.rebuildPageContainer(new RebuildPageContainer({ menuObject: glassesMenu(), containerTotalNum: 1, textObject: [textContainer(nativeContent)] }));
                layout = ''; baseSent = nativeContent; onStatus('G2 text fallback');
            }
        }
        if (ok) sent = content;
        else onStatus('G2 update failed');
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
        if (event.menuItemClickEvent) {
            const input = menuInput(event.menuItemClickEvent.itemID);
            if (input) { returningFromMenu = true; active = true; sent = ''; onInput(input); }
            return;
        }
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
            // A native menu selection closes the menu foreground, not our page.
            if (returningFromMenu) { returningFromMenu = false; active = true; sent = ''; onInput('active'); return; }
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
        const pageInput = types.some(value => value !== null && [OsEventTypeList.CLICK_EVENT, OsEventTypeList.SCROLL_TOP_EVENT, OsEventTypeList.SCROLL_BOTTOM_EVENT, OsEventTypeList.LONG_PRESS_EVENT, OsEventTypeList.LONG_PRESS_RELEASE_EVENT].includes(value));
        // Input delivered to our page proves it is visible again, even when the
        // host omits a foreground-enter event after dismissing its native menu.
        if (pageInput && !active) {
            active = true; returningFromMenu = false; sent = '';
            onInput('active');
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
