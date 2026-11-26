import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glassesMenu, menuInput } from '../app/src/glasses-menu.ts';
import { CreateStartUpPageContainer, RebuildPageContainer } from '@evenrealities/even_hub_sdk';

test('native menu survives page serialization and routes only navigation actions', () => {
    for (const Page of [CreateStartUpPageContainer, RebuildPageContainer]) {
        const page = new Page({ menuObject: glassesMenu() }).toJson();
        assert.deepEqual(page.menuObject, { menuItems: [
            { itemID: 1, itemName: 'Back' }, { itemID: 2, itemName: 'Open actions' },
        ] });
    }
    assert.equal(menuInput(1), 'back');
    assert.equal(menuInput(2), 'actions');
    assert.equal(menuInput(99), undefined);
    assert.equal(menuInput(), undefined);
});
