// decisions.two_suites (docs/features/e2e-harness): ONE source tree, two
// packages. The flag is a build-time constant so the Release package has no
// run-time input that could point it at a test host.
const e2eHost = process.env.INTERSTICE_E2E ?? '';

function defineE2E({types: t}) {
  return {
    name: 'interstice-define-e2e',
    visitor: {
      Identifier(path) {
        if (
          path.node.name === '__INTERSTICE_E2E__' &&
          path.isReferencedIdentifier()
        ) {
          path.replaceWith(t.stringLiteral(e2eHost));
        }
      },
    },
  };
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [defineE2E],
};
