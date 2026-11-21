import type { DemoScript } from '@x10/shared/demo';

const ALEX = 'demo-admin-alex';
const JORDAN = 'demo-approver-jordan';
const win = (sku: string) => `[data-testid="window"][data-sku="${sku}"]`;

export const script: DemoScript = {
  title: 'Doorbuster: a Cyber Monday deal desk with a margin guard, a second key and live sell-out forecasts',
  persona: ALEX,
  scenes: [
    {
      id: 'hook',
      say: [
        'Cyber Monday is the one night a retail team runs dozens of deals at once, so I drew the deal desk as a midnight arcade.',
        'Every deal is a shop window that glows brighter as it sells, with a queue outside sized by the last hour of sales.',
      ],
      async run(h) {
        await h.goto('/', ALEX);
        await h.pause(3500);
        await h.hover(h.page.locator(win('EL-EB-PUL')));
        await h.pause(2500);
      },
    },
    {
      id: 'arcade',
      say: [
        'This TV sold out before dawn, so its window is dark under a sold-out sign and the queue has gone home.',
        'An amber shutter means a deal will sell out before it ends, and the time is written on the shutter.',
      ],
      async run(h) {
        await h.spotlight(h.page.locator(win('EL-TV55-AUR')), 3500);
        await h.spotlight(h.page.locator(win('EL-EB-PUL')), 3500);
      },
    },
    {
      id: 'lens',
      say: ['Switch the lens to sell-out risk and every window is lit by whether it runs out early, misses its target or is on track.'],
      async run(h) {
        await h.click(h.page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /Sell-out risk/ }));
        await h.pause(3500);
      },
    },
    {
      id: 'today',
      say: ['Today ranks what needs me: the earbuds run out within two hours, two deep discounts wait for approval, and one draft sits below the margin floor.'],
      async run(h) {
        await h.spotlight(h.page.getByRole('complementary', { name: 'Today' }), 2500);
        await h.click(h.page.getByRole('button', { name: /Pulse wireless earbuds sells out around/ }));
        await h.pause(3500);
      },
    },
    {
      id: 'clock',
      say: ['The clock across the top replays the day from the sales, so I can watch each window light up and the TV go dark.'],
      async run(h) {
        await h.page.keyboard.press('Escape');
        await h.click(h.page.getByTestId('replay'));
        await h.pause(9000);
        await h.page.keyboard.press('Escape');
      },
    },
    {
      id: 'view-as',
      say: ['Viewed as an approver, everything that is not waiting at the velvet rope steps back.'],
      async run(h) {
        await h.click(h.page.getByRole('radiogroup', { name: 'View as' }).getByRole('radio', { name: 'Approver' }));
        await h.pause(3500);
      },
    },
    {
      id: 'margin-guard',
      say: [
        'In the Shopfront the margin guard checks the price as I type: at forty-six dollars this racer makes four point three percent, under the eight percent floor, so it will not save.',
        'At fifty-two dollars the margin clears the floor, but forty-seven percent off is a deep discount, so it goes to the velvet rope instead of opening.',
      ],
      async run(h) {
        await h.goto('/shopfront');
        await h.type(h.page.getByLabel('Deal name'), 'Comet RC racer, blue');
        await h.fill(h.page.getByLabel('SKU'), 'TY-RC-CMT-B');
        await h.select(h.page.getByLabel('Category'), 'Toys');
        await h.fill(h.page.getByLabel('List price'), '99');
        await h.fill(h.page.getByLabel('Unit cost'), '44');
        await h.type(h.page.getByLabel('Deal price'), '46');
        await h.fill(h.page.getByLabel('Stock'), '150');
        await h.fill(h.page.getByLabel('Target'), '120');
        await h.click(h.page.getByRole('button', { name: 'Send to the velvet rope' }));
        await h.spotlight(h.page.getByTestId('margin-guard'), 3000);
        await h.fill(h.page.getByLabel('Deal price'), '');
        await h.type(h.page.getByLabel('Deal price'), '52');
        await h.spotlight(h.page.getByTestId('window-preview'), 2500);
        await h.click(h.page.getByRole('button', { name: 'Send to the velvet rope' }));
        await h.pause(3000);
      },
    },
    {
      id: 'second-key',
      say: [
        'I set that price, so the rope will not open for me, even as an admin.',
        'Jordan approves it from the same queue, and the approval is its own record that the owner can never write.',
      ],
      async run(h) {
        await h.goto('/rope');
        await h.click(h.page.getByRole('link', { name: /Comet RC racer, blue/ }));
        await h.spotlight(h.page.getByTestId('own-deal'), 3000);
        await h.goto('/rope', JORDAN);
        await h.click(h.page.getByRole('link', { name: /Comet RC racer, blue/ }));
        await h.click(h.page.getByTestId('approve'));
        await h.pause(2500);
      },
    },
    {
      id: 'ticker',
      say: ['The Ticker shows the numbers behind the amber shutter: at forty units an hour, the last earbuds go mid-morning, hours before the deal ends.'],
      async run(h) {
        await h.goto('/ticker');
        await h.click(h.page.getByRole('link', { name: 'Pulse wireless earbuds' }).first());
        await h.spotlight(h.page.getByTestId('forecast'), 3500);
        await h.pause(1500);
      },
    },
    {
      id: 'close',
      say: ['Doorbuster: no deal below cost, no deep discount without a second person, and no sell-out nobody saw coming.'],
      async run(h) {
        await h.goto('/');
        await h.pause(4500);
      },
    },
  ],
};
