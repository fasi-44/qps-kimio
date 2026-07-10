// Runtime resolver for the @nabh/* workspace aliases in the COMPILED output.
// nest build (tsc) leaves `require("@nabh/shared")` etc. unresolved and emits
// the packages under dist/packages/*/src. Point the aliases there so plain
// `node dist/apps/api/src/main.js` runs without ts-node.
const path = require('path');
const tsConfigPaths = require('tsconfig-paths');

tsConfigPaths.register({
  baseUrl: path.join(__dirname, 'dist'),
  paths: {
    '@nabh/shared': ['packages/shared/src/index.js'],
    '@nabh/shared/*': ['packages/shared/src/*'],
    '@nabh/database': ['packages/database/src/index.js'],
    '@nabh/database/*': ['packages/database/src/*'],
  },
});
