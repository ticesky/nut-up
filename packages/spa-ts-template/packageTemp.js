module.exports = {
    scripts: {
        start: 'node scripts/start.js',
        build: 'node scripts/build.js',
        'build:dev': 'node scripts/build.js --dev',
        serve: 'node scripts/serve.js',
        count: 'node scripts/count.js',
        'count:js': 'node scripts/count.js --js',
        'i18n-scan': 'node scripts/i18n.js --scan',
        'i18n-read': 'node scripts/i18n.js --read',
        test: 'node scripts/test.js',
        commit: "cz"
    },
    babel: {
        presets: ['react-app'],
        plugins: []
    },
    browserslist: ['>0.2%', 'not dead', 'not op_mini all', 'ie >= 10'],
    husky: {
        hooks: {
            'commit-msg': 'commitlint --edit $HUSKY_GIT_PARAMS',
            'pre-commit': 'source check.sh && preCommit',
            'pre-push': 'source check.sh && prePush'
        }
    },
    eslintConfig: {
        extends: ['react-app', 'react-app/jest', './scripts/config/eslintrc.js']
    },
    stylelint: {
        extends: 'stylelint-config-recommended'
    },
    config: {
        commitizen: {
            path: 'cz-conventional-changelog'
        }
    },
    'lint-staged': {
        '{app,tests,static}/**/*.{js,jsx,mjs,ts,tsx}': [
            'prettier --write',
            'eslint --fix'
        ],
        '{app,tests,static}/**/*.{css,scss,less,json,html,md}': ['prettier --write']
    },
    engines: { node: '>=12.0.0' }
};
