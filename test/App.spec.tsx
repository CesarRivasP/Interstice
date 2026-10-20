import {Image} from 'react-native';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as React from 'react';

import {instances} from '@amazon-devices/react-native-w3cmedia';

import {App, packagedTrack, readJson} from '../src/App';
import {pressBack} from './setup';

/**
 * The App wires the REAL Vega adapter, so this suite is the one place the
 * w3cmedia mock still matters. Everything above the seam is tested against the
 * fake adapter in test/fakes/adapter.tsx and loads no platform module at all.
 */
describe('App — shell and navigation', () => {
  it('opens on a title list with a focusable entry', () => {
    const view = render(<App />);
    expect(view.getByLabelText('Play Tears of Steel')).toBeTruthy();
  });

  it('enters the player when a title is chosen', async () => {
    const view = render(<App />);
    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());
  });

  // Fails if: BACK has no stated destination. On a TV the remote's BACK is the
  // only way out of a screen, and one that consumes it without going anywhere
  // traps the viewer in the player — AC2, and the reason the criterion names
  // BACK separately from every other key.
  it('returns to the list on BACK, rather than trapping the viewer', async () => {
    const view = render(<App />);
    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());

    pressBack();

    await waitFor(() => expect(view.getByLabelText('Play Tears of Steel')).toBeTruthy());
    expect(view.queryByTestId('kepler-video-surface')).toBeNull();
  });

  // Fails if: the adapter is shared across opens. The Vega adapter is
  // single-use once destroy() has deinitialized its player — the second open()
  // attaches a MediaSource to a player that is gone and `sourceopen` never
  // fires, so the title sits on "Loading" with no error (e2e-harness D8, five
  // of five on the device). What the mock CAN see is the shape of the fix: the
  // second open initializes a player that is not the one BACK deinitialized.
  it('opens the same title again after BACK on a fresh player, not the destroyed one', async () => {
    const before = instances.players.length;
    const view = render(<App />);

    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());
    await waitFor(() => expect(instances.players.length).toBe(before + 1));
    const first = instances.players[before]!;
    await waitFor(() => expect(first.calls).toContain('initialize'));

    pressBack();
    await waitFor(() => expect(view.getByLabelText('Play Tears of Steel')).toBeTruthy());
    await waitFor(() => expect(first.calls).toContain('deinitialize'));

    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());
    await waitFor(() => expect(instances.players.length).toBe(before + 2));
    const second = instances.players[before + 1]!;
    expect(second).not.toBe(first);
    await waitFor(() => expect(second.calls).toContain('initialize'));
    // and nothing was asked of the player that BACK tore down
    expect(first.calls.filter(c => c === 'initialize')).toHaveLength(1);
  });
});

/**
 * The loader reads every throw from readJson as "the file is not there". So
 * what readJson throws on, and what it returns instead, is the whole
 * difference between "No description track was found" and "The description
 * track could not be read" (AC8, 02e §C.6).
 */
describe('App — readJson, the loader\'s view of a track file', () => {
  const realFetch = global.fetch;
  const respond = (status: number, body: string) =>
    jest.fn(async () => ({ok: status >= 200 && status < 300, status, text: async () => body}));
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('throws on a status that means absence, so the loader says missing', async () => {
    global.fetch = respond(404, 'Not Found') as unknown as typeof fetch;
    await expect(readJson('assets/x.standard.track.json')).rejects.toThrow('HTTP 404');
  });

  it('returns the parsed document when the body is JSON', async () => {
    global.fetch = respond(200, '{"version":"1"}') as unknown as typeof fetch;
    await expect(readJson('assets/x.standard.track.json')).resolves.toEqual({version: '1'});
  });

  // Fails if: a parse failure is thrown. That is e2e-harness D9: a track file
  // served cut in half reached the viewer as "no track was found", when there
  // was one that could not be read. The value returned must be one the
  // package's validator rejects as malformed — a string is not an object.
  it('does NOT throw on a body that is not JSON — that file exists, and the loader must say so', async () => {
    global.fetch = respond(200, '{"version":"1","asset_id":"x","cu') as unknown as typeof fetch;
    const got = await readJson('assets/x.standard.track.json');
    expect(typeof got).toBe('string');
    expect(got === null || typeof got === 'object').toBe(false);
  });
});

/**
 * R57: the film's track travels inside the package. metro inlines a required
 * .json, so there is no file to fetch at the product path; readJson hands over
 * the packaged object, its relative audio paths resolved to packaged assets.
 */
describe('App — the packaged track', () => {
  const PATH = '/pkg/bundle/assets/src/assets/tears-of-steel.standard.track.json';
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  // Fails if: the device fetches a file metro never copied, and the viewer of
  // a title that HAS a track is told there is none.
  it('is read from the package, not fetched, with every audio_uri resolved', async () => {
    jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({uri: 'file:///pkg/cue.m4a', width: 0, height: 0, scale: 1});
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const track = (await readJson(PATH)) as {asset_id: string; cues: {status: string; audio_uri: string}[]};
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(track.asset_id).toBe('tears-of-steel');
    expect(track.cues.length).toBeGreaterThan(0);
    for (const cue of track.cues.filter(c => c.status === 'ok')) expect(cue.audio_uri).toBe('file:///pkg/cue.m4a');
  });

  it('leaves every other path to fetch — the VARIANT fixture and the missing levels', () => {
    expect(packagedTrack('http://localhost:8099/fx/e2e-fixture.standard.track.json')).toBeUndefined();
    expect(packagedTrack('/pkg/bundle/assets/src/assets/tears-of-steel.detailed.track.json')).toBeUndefined();
  });
});

// R45-F3: the list showed no focus. Fails if: the focused title stops looking
// different from the others.
describe('App — the title list shows where focus is', () => {
  it('draws the focused title inverted with an outline, and only while focused', () => {
    const view = render(<App />);
    const style = () =>
      Object.assign({}, ...[view.getByTestId('title-Tears of Steel').props.style].flat(Infinity).filter(Boolean));
    expect(style().borderColor).toBe('transparent');
    fireEvent(view.getByTestId('title-Tears of Steel'), 'focus');
    expect(style()).toMatchObject({backgroundColor: '#fff', borderColor: '#FFD400'});
    fireEvent(view.getByTestId('title-Tears of Steel'), 'blur');
    expect(style().borderColor).toBe('transparent');
  });
});
