/**
 * Jest setup for the app half.
 *
 * `BackHandler` is a REAL API on Vega — `@amazon-devices/react-native-kepler`
 * ships `BackHandler.kepler.js`, which wires the standard interface to the
 * platform's `UserInputManager`. It is simply absent from the jest preset's
 * module shim, so a component that uses it throws under test while working on
 * the device.
 *
 * Filling the gap rather than mocking the module keeps that distinction honest:
 * this is a hole in the test environment, not a missing platform capability, and
 * the component imports the portable API rather than the Vega-specific
 * `useKeplerBackHandler`.
 */
const backListeners = new Set<() => boolean>();

/** test helper — fire the hardware BACK key, newest listener first */
export function pressBack(): void {
  for (const handler of [...backListeners].reverse()) if (handler()) return;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactNative = require('react-native');

if (!ReactNative.BackHandler?.addEventListener) {
  // The kepler module exposes its exports as GETTERS, so a plain assignment is
  // a silent no-op — the component keeps seeing `undefined`. defineProperty is
  // what actually replaces it.
  Object.defineProperty(ReactNative, 'BackHandler', {
    configurable: true,
    get: () => ({
      addEventListener: (_name: string, handler: () => boolean) => {
        backListeners.add(handler);
        return {remove: () => backListeners.delete(handler)};
      },
      exitApp: () => undefined,
    }),
  });
}

beforeEach(() => backListeners.clear());
