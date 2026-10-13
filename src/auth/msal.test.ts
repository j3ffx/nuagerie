import { describe, expect, it } from 'vitest';
import { microsoftReachable } from './msal.ts';

const answer = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as typeof fetch;

describe('microsoftReachable', () => {
  it('is true when Microsoft answers with its sign-in metadata', async () => {
    const fetcher = answer(JSON.stringify({ issuer: 'https://login.microsoftonline.com/x/v2.0' }));
    expect(await microsoftReachable(fetcher)).toBe(true);
  });

  it('is false on a network that does not let it through', async () => {
    // A plane's Wi-Fi or a portal: no answer, an error page, or someone else's page.
    const refused = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await microsoftReachable(refused)).toBe(false);
    expect(await microsoftReachable(answer('<html>Portal</html>'))).toBe(false);
    expect(await microsoftReachable(answer('{}'))).toBe(false);
    expect(await microsoftReachable(answer('', 503))).toBe(false);
  });

  it('gives up on a request that never ends', async () => {
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'TimeoutError')));
      })) as typeof fetch;
    expect(await microsoftReachable(hanging, 30)).toBe(false);
  });
});
