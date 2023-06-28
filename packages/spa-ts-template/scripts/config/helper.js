const fs = require('fs');
const chalk = require('react-dev-utils/chalk');
const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const evalSourceMapMiddleware = require('nut-up-utils/evalSourceMapMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');
const getHttpsConfig = require('nut-up-utils/getHttpsConfig');
const ignoredFiles = require('react-dev-utils/ignoredFiles');
const paths = require('./paths');
const pkg = paths.appPackageJson;

const sourceMaps = {};
// todo study
require('source-map-support').install({
    retrieveSourceMap: filename => {
        let map = sourceMaps[`${filename}.map`];

        return (
            map && {
                map: JSON.parse(map)
            }
        );
    }
});

function createDevServerConfig(proxy, allowedHost, host, port) {
    const disableHostCheck = !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true';

    return {
        // WebpackDevServer 2.4.3 introduced a security fix that prevents remote
        // websites from potentially accessing local content through DNS rebinding:
        // https://github.com/webpack/webpack-dev-server/issues/887
        // https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        // However, it made several existing use cases such as development in cloud
        // environment or subdomains in development significantly more complicated:
        // https://github.com/facebook/create-react-app/issues/2271
        // https://github.com/facebook/create-react-app/issues/2233
        // While we're investigating better solutions, for now we will take a
        // compromise. Since our WDS configuration only serves files in the `public`
        // folder we won't consider accessing them a vulnerability. However, if you
        // use the `proxy` feature, it gets more dangerous because it can expose
        // remote code execution vulnerabilities in backends like Django and Rails.
        // So we will disable the host check normally, but enable it if you have
        // specified the `proxy` setting. Finally, we let you override it if you
        // really know what you're doing with a special environment variable.
        // Note: ["localhost", ".localhost"] will support subdomains - but we might
        // want to allow setting the allowedHosts manually for more complex setups
        allowedHosts: disableHostCheck ? 'all' : [allowedHost],
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, HEAD, DELETE, FETCH'
        },
        // Enable gzip compression of generated files.
        compress: true,
        static: {
            // By default WebpackDevServer serves physical files from current directory
            // in addition to all the virtual build products that it serves from memory.
            // This is confusing because those files won’t automatically be available in
            // production build folder unless we copy them. However, copying the whole
            // project directory is dangerous because we may expose sensitive files.
            // Instead, we establish a convention that only files in `public` directory
            // get served. Our build script will copy `public` into the `build` folder.
            // In `index.html`, you can get URL of `public` folder with %PUBLIC_URL%:
            // <link rel="icon" href="%PUBLIC_URL%/favicon.ico">
            // In JavaScript code, you can access it with `process.env.PUBLIC_URL`.
            // Note that we only recommend to use `public` folder as an escape hatch
            // for files like `favicon.ico`, `manifest.json`, and libraries that are
            // for some reason broken when imported through webpack. If you just want to
            // use an image, put it in `src` and `import` it from JavaScript instead.
            directory: paths.appPublic,
            publicPath: paths.publicUrlOrPath,
            // By default files from `contentBase` will not trigger a page reload.
            watch: {
                // Reportedly, this avoids CPU overload on some systems.
                // https://github.com/facebook/create-react-app/issues/293
                // src/node_modules is not ignored to support absolute imports
                // https://github.com/facebook/create-react-app/issues/1065
                ignored: ignoredFiles(paths.appSrc)
            }
        },
        // todo study
        webSocketServer: 'ws',
        client: false,
        hot: true,
        devMiddleware: {
            // It is important to tell WebpackDevServer to use the same "publicPath" path as
            // we specified in the webpack config. When homepage is '.', default to serving
            // from the root.
            // remove last slash so user can land on `/test` instead of `/test/`
            publicPath: paths.publicUrlOrPath.slice(0, -1),
        },
        https: getHttpsConfig(paths.root),
        host,
        port,
        historyApiFallback: {
            // Paths with dots should still use the history fallback.
            // See https://github.com/facebook/create-react-app/issues/387.
            disableDotRule: true,
            index: paths.publicUrlOrPath
        },
        // `proxy` is run between `before` and `after` `webpack-dev-server` hooks
        proxy,
        // todo study
        setupMiddlewares(middlewares, devServer) {
            const app = devServer.app;

            middlewares.unshift(evalSourceMapMiddleware(devServer), errorOverlayMiddleware());

            if (fs.existsSync(paths.proxySetup)) {
                require(paths.proxySetup)(app);
            }

            middlewares.push(
                redirectServedPath(paths.publicUrlOrPath),
                noopServiceWorkerMiddleware(paths.publicUrlOrPath)
            );

            return middlewares;
        }
    };
}

function printServeCommand() {
    const usedEnvs = ['SSR', 'NODE_ENV', 'BUILD_DIR', 'BASE_NAME', 'PUBLIC_URL'].filter(name =>
        Boolean(process.env[name])
    );

    console.log(
        (usedEnvs.length ? `${usedEnvs.map(name => `${name}=${process.env[name]}`).join(' ')} ` : '') +
        chalk.cyan('npm run serve')
    );
}

module.exports = {
    createDevServerConfig,
    printServeCommand
};
