// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { getBootstrapPayload } from './bootstrap';

const originalLocation = window.location;

describe('getBootstrapPayload', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('reads imageDataUrl from the hash when the query stays small', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://127.0.0.1:3100/editor?sourceType=capture#imageDataUrl=data%3Aimage%2Fpng%3Bbase64%2CZm9v'),
    });

    expect(getBootstrapPayload()).toEqual({
      sourceType: 'capture',
      imageDataUrl: 'data:image/png;base64,Zm9v',
      draftId: undefined,
    });
  });

  it('keeps supporting existing query-string payloads', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://127.0.0.1:3100/editor?sourceType=upload&imageDataUrl=data%3Aimage%2Fpng%3Bbase64%2CYmFy'),
    });

    expect(getBootstrapPayload()).toEqual({
      sourceType: 'upload',
      imageDataUrl: 'data:image/png;base64,YmFy',
      draftId: undefined,
    });
  });
});
