/* eslint @typescript-eslint/no-var-requires: 0 */
const path = require('path');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const glob = require('glob');
const semver = require('semver');
const getPublicUrlOrPath = require('react-dev-utils/getPublicUrlOrPath');
const isDev = process.env.NODE_ENV === 'development';
const lodash = require('lodash');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const pkg = fs.readJsonSync(resolveApp('package.json'));
// todo study
const publicUrlOrPath = getPublicUrlOrPath(
    process.env.NODE_ENV === 'development' && process.env.WEBPACK_BUILDING !== 'true',
    pkg.homepage,
    process.env.PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' && process.env.SKIP_CDN !== 'true' && pkg.cdn
        ? pkg.cdn.host + pkg.cdn.path
        : process.env.BASE_NAME)
);
const moduleFileExtensions = ['mjs', 'js', 'ts', 'tsx', 'jsx'];

const hasJsxRuntime = (() => {
    try {
        if (process.env.DISABLE_NEW_JSX_TRANSFORM !== 'true') {
            require.resolve('react/jsx-runtime');

            return true;
        }
    } catch (e) { }

    return false;
})();

const useReactRefresh = (() => {
    try {
        if (process.env.DISABLE_FAST_REFRESH !== 'true') {
            const react = require(require.resolve('react'));

            return semver.gt(react.version, '16.9.0');
        }
    } catch (e) { }

    return false;
})();

const webModuleFileExtensions = moduleFileExtensions.map(ext => `web.${ext}`).concat(moduleFileExtensions, 'json');

function resolveApp(...relativePaths) {
    return path.resolve(appDirectory, ...relativePaths);
}

const webJSEntries = {};

glob.sync(resolveApp('app/!(_)*.{j,t}s?(x)')).forEach(function (file) {
    const basename = path.basename(file).replace(/\.[jt]sx?$/, '');
    webJSEntries[basename] = file;
});

const webHtmlEntries = {};

glob.sync(resolveApp('public/!(_)*.html')).forEach(function (file) {
    const basename = path.basename(file).replace(/\.html$/, '');
    webHtmlEntries[basename] = file;
});

const moduleAlias = Object.assign(
    glob.sync(`${resolveApp('app/*')}/`).reduce((alias, file) => {
        alias[path.basename(file)] = path.resolve(file);

        return alias;
    }, {}),
    lodash.mapValues(pkg.alias, function (relativePath) {
        if (fs.pathExistsSync(resolveApp(relativePath))) {
            return resolveApp(relativePath);
        }

        return relativePath;
    })
);

const appBuildName = process.env.BUILD_DIR || (isDev ? 'buildDev' : 'build');

module.exports = {
    dotenv: resolveApp('.env'),
    root: resolveApp(''),
    appBuild: resolveApp(appBuildName),
    appPublic: resolveApp('public'),
    appHtml: webHtmlEntries.index || Object.values(webHtmlEntries)[0] || resolveApp('public/index.html'),
    appIndexJs: webJSEntries.index || Object.values(webJSEntries)[0],
    appPackageJson: pkg,
    appSrc: resolveApp('app'),
    appTsConfig: resolveApp('tsconfig.json'),
    staticSrc: resolveApp('static'),
    locals: resolveApp('locals'),
    proxySetup: resolveApp('setupProxy.js'),
    appNodeModules: resolveApp('node_modules'),
    jestConfigFile: resolveApp('scripts/config/jest.config.js'),
    publicUrlOrPath,
    webModuleFileExtensions,
    moduleAlias,
    // js entry
    entries: webJSEntries,
    // html entry
    pageEntries: webHtmlEntries,
    // 一些命令检测
    serve: hasInstall('serve'),
    npmCommander: ['cnpm', 'npm'].find(hasInstall),
    hasJsxRuntime,
    useReactRefresh
};

function hasInstall(command) {
    try {
        execSync(`${command} --version`, {
            stdio: 'ignore'
        });

        return true;
    } catch (e) {
        return false;
    }
}
