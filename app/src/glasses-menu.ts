import { MenuContainerProperty, MenuItemProperty } from '@evenrealities/even_hub_sdk';

// Include this on every rebuild: omitting it clears the native menu.
export function glassesMenu() {
    return new MenuContainerProperty({ menuItems: [
        new MenuItemProperty({ itemID: 1, itemName: 'Back' }),
        new MenuItemProperty({ itemID: 2, itemName: 'Open actions' }),
    ] });
}

export function menuInput(id?: number): 'back' | 'actions' | undefined {
    if (id === 1) return 'back';
    if (id === 2) return 'actions';
}
