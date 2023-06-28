if (!process.env.NODE_ENV) {
    process.env.BABEL_ENV = 'production';
    process.env.NODE_ENV = 'production';
}

process.on('unhandledRejection', err => {
    if (err) {
        throw err;
    }
});

require('./config/env');

const path = require('path');
const chalk = require('react-dev-utils/chalk');
const express = require('express');
const ora = require('nut-up-utils/ora');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
const clearConsole = require('react-dev-utils/clearConsole');
const openBrowser = require('react-dev-utils/openBrowser');
const { prepareUrls, choosePort, prepareProxy } = require('nut-up-utils/WebpackDevServerUtils');
const getPublicUrlOrPath = require('react-dev-utils/getPublicUrlOrPath');
const history = require('connect-history-api-fallback');
const paths = require('./config/paths');
const pkg = paths.appPackageJson;

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const spinner = ora('正在启动服务器...').start();

const isInteractive = process.stdout.isTTY;
const publicUrlOrPath = getPublicUrlOrPath(true, process.env.BASE_NAME || pkg.homepage || process.env.PUBLIC_URL);

const proxySetting = process.env.PROXY || pkg.proxy;
const proxyConfig = prepareProxy(proxySetting, paths.appPublic, paths.publicUrlOrPath);

checkBrowsers(paths.root, isInteractive)
    .then(() => {
        return choosePort(HOST, DEFAULT_PORT, spinner);
    })
    .then(port => {
        if (port == null) {
            return;
        }

        const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
        const urls = prepareUrls(protocol, HOST, port, publicUrlOrPath.slice(0, -1));

        const server = express();
        const createStatic = basename =>
            server.use(
                basename,
                express.static(paths.appBuild, {
                    index: 'index.html',
                    setHeaders(res) {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, HEAD, DELETE, FETCH');
                    },
                    fallthrough: true
                })
            );

        server.use(history());

        createStatic('/');

        if (publicUrlOrPath.startsWith('/') && publicUrlOrPath !== '/') {
            createStatic(publicUrlOrPath);
        }

        proxyConfig && server.use(...proxyConfig.map(createProxyMiddleware));

        server.listen(port, HOST, err => {
            if (err) {
                return console.log(err);
            }

            if (isInteractive) {
                clearConsole();
            }

            spinner.succeed(chalk.green(`应用(${pkg.name})已启动:`));
            console.log();

            if (urls.lanUrlForTerminal) {
                console.log(`  ${chalk.bold('本地:')}  ${chalk.cyan(urls.localUrlForTerminal)}`);
                console.log(`  ${chalk.bold('远程:')}  ${chalk.cyan(urls.lanUrlForTerminal)}`);
            } else {
                console.log(`  ${urls.localUrlForTerminal}`);
            }

            console.log();

            openBrowser(urls.localUrlForBrowser);
        });
    })
    .catch(err => {
        if (err && err.message) {
            console.log(err.message);
        }

        process.exit(1);
    });
