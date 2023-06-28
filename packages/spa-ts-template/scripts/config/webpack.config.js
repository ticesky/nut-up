/* eslint import/order:0 */
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const resolve = require('resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const ImageMinimizerPlugin = require('nut-up-utils/ImageMinimizerPlugin');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const ForkTsCheckerWebpackPlugin = require('react-dev-utils/ForkTsCheckerWebpackPlugin');
const typescriptFormatter = require('nut-up-utils/typescriptFormatter');
const createEnvironmentHash = require('nut-up-utils/createEnvironmentHash');
const getClientEnvironment = require('./env');
const htmlAttrsOptions = require('./htmlAttrsOptions');
const paths = require('./paths');
const tsconfig = require(paths.appTsConfig);
const pkg = paths.appPackageJson;

const webpackDevClientEntry = require.resolve('nut-up-utils/webpackHotDevClient');
const reactRefreshOverlayEntry = require.resolve('nut-up-utils/refreshOverlayInterop');

const isBuilding = process.env.WEBPACK_BUILDING === 'true';
const shouldUseRelativeAssetPath = !paths.publicUrlOrPath.startsWith('http');
// style files regexes
const cssRegex = /\.css$/;
const sassRegex = /\.(scss|sass)$/;
const lessRegex = /\.less$/;

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = function (webpackEnv) {
    const isEnvDevelopment = webpackEnv === 'development';
    const isEnvProduction = webpackEnv === 'production';
    // Variable used for enabling profiling in Production
    // passed into alias object. Uses a flag if passed into the build command
    const isEnvProductionProfile = isEnvProduction && process.argv.includes('--profile');
    // Source maps are resource heavy and can cause out of memory issue for large source files.
    const shouldUseSourceMap = isEnvProduction
        ? process.env.GENERATE_SOURCEMAP === 'true'
        : process.env.GENERATE_SOURCEMAP !== 'false';
    // Some apps do not need the benefits of saving a web request, so not inlining the chunk
    // makes for a smoother build process.
    const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';
    const shouldUseSW = process.env.GENERATE_SW === 'true' || !!pkg.pwa;
    const shouldUseReactRefresh = paths.useReactRefresh;
    const shouldUseWebpackCache = process.env.DISABLE_WEBPACK_CACHE !== 'true';

    // We will provide `paths.publicUrlOrPath` to our app
    // as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
    // Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
    // Get environment variables to inject into our app.
    const env = getClientEnvironment({
        PUBLIC_URL: paths.publicUrlOrPath.slice(0, -1),
        ENABLE_PWA: shouldUseSW
    });

    const babelOption = {
        babelrc: false,
        configFile: false,
        compact: false,
        presets: [[require.resolve('babel-preset-react-app/dependencies'), { helpers: true }]],
        cacheDirectory: true,
        // See #6846 for context on why cacheCompression is disabled
        cacheCompression: false,
        // Babel sourcemaps are needed for debugging into node_modules
        // code.  Without the options below, debuggers like VSCode
        // show incorrect code and set breakpoints on the wrong lines.
        sourceMaps: shouldUseSourceMap,
        inputSourceMap: shouldUseSourceMap
    };

    // common function to get style loaders
    const getStyleLoaders = (cssOptions, preProcessor) => {
        const loaders = [
            isBuilding
                ? {
                    loader: MiniCssExtractPlugin.loader,
                    // css is located in `static/css`, use '../../' to locate index.html folder
                    // in production `paths.publicUrlOrPath` can be a relative path
                    options: {
                        publicPath: shouldUseRelativeAssetPath ? '../../' : undefined,
                        esModule: true
                    }
                }
                : require.resolve('style-loader'),
            {
                loader: require.resolve('css-loader'),
                options: Object.assign({ sourceMap: shouldUseSourceMap }, cssOptions)
            },
            {
                // Options for PostCSS as we reference these options twice
                // Adds vendor prefixing based on your specified browser support in
                // package.json
                loader: require.resolve('postcss-loader'),
                options: {
                    postcssOptions: {
                        // Necessary for external CSS imports to work
                        // https://github.com/facebook/create-react-app/issues/2677
                        ident: 'postcss',
                        plugins: [
                            pkg.useRem && [
                                'postcss-pxtorem',
                                {
                                    rootValue: 14,
                                    propList: ['*'],
                                    selectorBlackList: [/^html$/i, /\.px-/],
                                    mediaQuery: false
                                }
                            ],
                            'postcss-flexbugs-fixes',
                            [
                                'postcss-preset-env',
                                {
                                    autoprefixer: {
                                        flexbox: 'no-2009'
                                    },
                                    stage: 3
                                }
                            ]
                        ].filter(Boolean)
                    },
                    sourceMap: shouldUseSourceMap
                }
            }
        ].filter(Boolean);

        if (preProcessor) {
            // todo study
            loaders.push({
                loader: require.resolve(preProcessor),
                options: Object.assign(
                    {},
                    { sourceMap: shouldUseSourceMap },
                    preProcessor === 'less-loader'
                        ? {
                            lessOptions: {
                                javascriptEnabled: true,
                                rewriteUrls: 'all',
                                math: 'always'
                            }
                        }
                        : {
                            implementation: require('sass')
                        }
                )
            });
        }

        return loaders;
    };

    // eslint-disable-next-line
    const matchScriptStylePattern = /<\!--\s*script:\s*([\w]+)(?:\.[jt]sx?)?\s*-->/g;
    const htmlInjects = [];

    Object.keys(paths.pageEntries).forEach(function (name) {
        const chunks = ['vendor'];
        const file = paths.pageEntries[name];

        if (paths.entries[name]) {
            chunks.push(name);
        }

        const contents = fs.readFileSync(file);
        let matches;

        while ((matches = matchScriptStylePattern.exec(contents))) {
            chunks.push(matches[1]);
        }

        const createHtmlWebpackPlugin = function (filename, template) {
            // Generates an `index.html` file with the <script> injected.
            return new HtmlWebpackPlugin(
                Object.assign(
                    {
                        chunks,
                        filename,
                        template,
                        inject: true,
                        chunksSortMode: 'manual',
                        scriptLoading: 'blocking'
                    },
                    isEnvProduction
                        ? {
                            minify: {
                                ignoreCustomComments: [/^\s+(your\shtml|root)\s+$/],
                                removeComments: true,
                                collapseWhitespace: true,
                                removeRedundantAttributes: true,
                                useShortDoctype: true,
                                removeEmptyAttributes: true,
                                removeStyleLinkTypeAttributes: true,
                                keepClosingSlash: true,
                                minifyJS: true,
                                minifyCSS: true,
                                minifyURLs: true
                            }
                        }
                        : undefined
                )
            );
        };

        htmlInjects.push(createHtmlWebpackPlugin(`${name}.html`, file));
    });

    return {
        target: 'browserslist',
        stats: 'none',
        mode: isEnvProduction ? 'production' : 'development',
        // Stop compilation early in production
        bail: isEnvProduction,
        devtool: shouldUseSourceMap
            ? isBuilding
                ? isEnvProduction
                    ? 'hidden-source-map'
                    : 'cheap-module-source-map'
                : 'cheap-module-source-map'
            : false,
        entry: Object.assign(
            {
                vendor: [require.resolve('./polyfills'), !isBuilding && webpackDevClientEntry]
                    .concat(pkg.vendor || [])
                    .filter(Boolean)
            },
            Object.keys(paths.entries).reduce(
                (entries, name) =>
                    Object.assign(entries, {
                        [name]: {
                            import: paths.entries[name],
                            dependOn: 'vendor'
                        }
                    }),
                {}
            )
        ),
        output: {
            path: paths.appBuild,
            // Add /* filename */ comments to generated require()s in the output.
            pathinfo: isEnvDevelopment,
            // There will be one main bundle, and one file per asynchronous chunk.
            // In development, it does not produce real files.
            filename: isEnvProduction
                ? 'static/js/[name].[contenthash:8].js'
                : 'static/js/[name].[fullhash:8].js',
            // There are also additional JS chunk files if you use code splitting.
            chunkFilename: isEnvProduction ? 'static/js/[name].[contenthash:8].js' : 'static/js/[name].[fullhash:8].js',
            assetModuleFilename: 'static/media/[name].[hash:8][ext]',
            // webpack uses `publicPath` to determine where the app is being served from.
            // It requires a trailing slash, or the file assets will get an incorrect path.
            // We inferred the "public path" (such as / or /my-project) from homepage.
            publicPath: paths.publicUrlOrPath,
            // Point sourcemap entries to original disk location (format as URL on Windows)
            devtoolModuleFilenameTemplate: isEnvProduction
                ? info => path.relative(paths.appSrc, info.absoluteResourcePath).replace(/\\/g, '/')
                : info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')
        },
        // todo study
        cache:
            shouldUseWebpackCache &&
            (isBuilding
                ? {
                    type: 'filesystem',
                    version: createEnvironmentHash(pkg.engines || {}),
                    buildDependencies: {
                        config: [__filename]
                    }
                }
                : true),
        infrastructureLogging: {
            level: 'none'
        },
        optimization: {
            minimize: isEnvProduction,
            // This is only used in production mode
            minimizer: [
                new TerserPlugin({
                    extractComments: false,
                    terserOptions: {
                        parse: {
                            // We want terser to parse ecma 8 code. However, we don't want it
                            // to apply any minification steps that turns valid ecma 5 code
                            // into invalid ecma 5 code. This is why the 'compress' and 'output'
                            // sections only apply transformations that are ecma 5 safe
                            // https://github.com/facebook/create-react-app/pull/4234
                            ecma: 8
                        },
                        compress: {
                            ecma: 5,
                            warnings: false,
                            // Disabled because of an issue with Uglify breaking seemingly valid code:
                            // https://github.com/facebook/create-react-app/issues/2376
                            // Pending further investigation:
                            // https://github.com/mishoo/UglifyJS2/issues/2011
                            comparisons: false,
                            // Disabled because of an issue with Terser breaking valid code:
                            // https://github.com/facebook/create-react-app/issues/5250
                            // Pending further investigation:
                            // https://github.com/terser-js/terser/issues/120
                            inline: 2
                        },
                        mangle: {
                            safari10: true
                        },
                        // Added for profiling in devtools
                        keep_classnames: isEnvProductionProfile,
                        keep_fnames: isEnvProductionProfile,
                        output: {
                            ecma: 5,
                            comments: /@(license|author)/i,
                            // Turned on because emoji and regex is not minified properly using default
                            // https://github.com/facebook/create-react-app/issues/2488
                            ascii_only: true
                        }
                    },
                    parallel: true
                }),
                // This is only used in production mode
                new CssMinimizerPlugin(),
                new ImageMinimizerPlugin({
                    minimizer: {
                        implementation: ImageMinimizerPlugin.imageminMinify,
                        options: {
                            plugins: [
                                'gifsicle',
                                [
                                    'mozjpeg',
                                    {
                                        quality: 60
                                    }
                                ],
                                [
                                    'pngquant',
                                    {
                                        quality: [0.7, 0.9]
                                    }
                                ],
                                'svgo'
                            ]
                        }
                    },
                    loader: true,
                    severityError: 'off'
                })
            ],
            splitChunks: {
                cacheGroups: {
                    i18n: {
                        chunks: 'all',
                        test: /locals\/\w+\.json$/,
                        enforce: true,
                        name: 'i18n'
                    }
                }
            },
            runtimeChunk: 'single'
        },
        resolve: {
            modules: ['node_modules', paths.appNodeModules, paths.root].concat(),
            // These are the reasonable defaults supported by the Node ecosystem.
            // We also include JSX as a common component filename extension to support
            // some tools, although we do not recommend using it, see:
            // https://github.com/facebook/create-react-app/issues/290
            // `web` extension prefixes have been added for better support
            // for React Native Web.
            extensions: paths.webModuleFileExtensions.map(
                ext => `.${ext}`
            ),
            alias: {
                // Support React Native Web
                // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
                'react-native': 'react-native-web',
                // 'react-hot-loader': 'nut-up-utils/react-hot-loader',
                // Allows for better profiling with ReactDevTools
                ...(isEnvProductionProfile && {
                    'react-dom$': 'react-dom/profiling',
                    'scheduler/tracing': 'scheduler/tracing-profiling'
                }),
                ...paths.moduleAlias
            },
            plugins: [
                // todo study
                new DirectoryNamedWebpackPlugin({
                    honorIndex: true,
                    exclude: /node_modules|libs/
                })
            ]
        },
        module: {
            strictExportPresence: true,
            rules: [
                // Handle node_modules packages that contain sourcemaps
                shouldUseSourceMap && {
                    enforce: 'pre',
                    exclude: /@babel(?:\/|\\{1,2})runtime/,
                    test: /\.(js|mjs|jsx|ts|tsx|css)$/,
                    use: 'source-map-loader'
                },
                {
                    // "oneOf" will traverse all following loaders until one will
                    // match the requirements. When no loader matches it will fall
                    // back to the "file" loader at the end of the loader list.
                    oneOf: [
                        {
                            resourceQuery(query) {
                                return new URLSearchParams(query).has('raw');
                            },
                            type: 'asset/source'
                        },
                        {
                            test: /\.html$/,
                            use: [
                                {
                                    loader: require.resolve('babel-loader'),
                                    options: babelOption
                                },
                                {
                                    loader: require.resolve('html-loader'),
                                    options: htmlAttrsOptions
                                }
                            ]
                        },
                        {
                            test: /\.svg$/,
                            use: [
                                {
                                    loader: '@svgr/webpack',
                                    options: {
                                        prettier: false,
                                        svgo: false,
                                        titleProp: true,
                                        ref: true
                                    }
                                },
                                {
                                    loader: 'file-loader',
                                    options: {
                                        name: 'static/media/[name].[hash:8].[ext]'
                                    }
                                }
                            ],
                            type: 'javascript/auto',
                            issuer: {
                                and: [/\.(ts|tsx|js|jsx|mjs|md|mdx)$/]
                            }
                        },
                        // Process application JS with Babel.
                        // The preset includes JSX, Flow, TypeScript, and some ESnext features.
                        {
                            test: /\.(js|mjs|jsx|ts|tsx)$/,
                            include: paths.appSrc,
                            loader: require.resolve('babel-loader'),
                            options: {
                                customize: require.resolve('babel-preset-react-app/webpack-overrides'),
                                presets: [
                                    [
                                        'react-app',
                                        {
                                            runtime: paths.hasJsxRuntime ? 'automatic' : 'classic'
                                        }
                                    ]
                                ],
                                plugins: [
                                    require.resolve('babel-plugin-auto-css-modules-flag'),
                                    !isBuilding && shouldUseReactRefresh && 'react-refresh/babel'
                                ].filter(Boolean),
                                // This is a feature of `babel-loader` for webpack (not Babel itself).
                                // It enables caching results in ./node_modules/.cache/babel-loader/
                                // directory for faster rebuilds.
                                cacheDirectory: true,
                                // See #6846 for context on why cacheCompression is disabled
                                cacheCompression: false,
                                compact: isEnvProduction,
                            }
                        },
                        // Process any JS outside of the app with Babel.
                        // Unlike the application JS, we only compile the standard ES features.
                        {
                            test: /\.(js|mjs)$/,
                            exclude: /@babel(?:\/|\\{1,2})runtime/,
                            loader: require.resolve('babel-loader'),
                            options: babelOption
                        },
                        // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
                        // using the extension .module.css
                        {
                            test: cssRegex,
                            resourceQuery: /modules/,
                            use: getStyleLoaders({
                                importLoaders: 1,
                                modules: {
                                    getLocalIdent: getCSSModuleLocalIdent,
                                    mode: 'local'
                                }
                            })
                        },
                        // "postcss" loader applies autoprefixer to our CSS.
                        // "css" loader resolves paths in CSS and adds assets as dependencies.
                        // "style" loader turns CSS into JS modules that inject <style> tags.
                        // In production, we use MiniCSSExtractPlugin to extract that CSS
                        // to a file, but in development "style" loader enables hot editing
                        // of CSS.
                        // By default we support CSS Modules with the extension .module.css
                        {
                            test: cssRegex,
                            use: getStyleLoaders({
                                importLoaders: 1,
                                modules: {
                                    mode: 'icss'
                                }
                            }),
                            // Don't consider CSS imports dead code even if the
                            // containing package claims to have no side effects.
                            // Remove this when webpack adds a warning or an error for this.
                            // See https://github.com/webpack/webpack/issues/6571
                            sideEffects: true
                        },
                        // Adds support for CSS Modules, but using SASS
                        // using the extension .module.scss or .module.sass
                        {
                            test: sassRegex,
                            resourceQuery: /modules/,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 2,
                                    modules: {
                                        getLocalIdent: getCSSModuleLocalIdent,
                                        mode: 'local'
                                    }
                                },
                                'sass-loader'
                            )
                        },
                        // Opt-in support for SASS (using .scss or .sass extensions).
                        // By default we support SASS Modules with the
                        // extensions .module.scss or .module.sass
                        {
                            test: sassRegex,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 2,
                                    modules: {
                                        mode: 'icss'
                                    }
                                },
                                'sass-loader'
                            ),
                            // Don't consider CSS imports dead code even if the
                            // containing package claims to have no side effects.
                            // Remove this when webpack adds a warning or an error for this.
                            // See https://github.com/webpack/webpack/issues/6571
                            sideEffects: true
                        },
                        {
                            test: lessRegex,
                            resourceQuery: /modules/,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 2,
                                    modules: {
                                        getLocalIdent: getCSSModuleLocalIdent,
                                        mode: 'local'
                                    }
                                },
                                'less-loader'
                            )
                        },
                        {
                            test: lessRegex,
                            use: getStyleLoaders(
                                {
                                    importLoaders: 2,
                                    modules: {
                                        mode: 'icss'
                                    }
                                },
                                'less-loader'
                            ),
                            sideEffects: true
                        },
                        {
                            test: /\.(txt|htm)$/,
                            type: 'asset/source'
                        },
                        // "file" loader makes sure those assets get served by WebpackDevServer.
                        // When you `import` an asset, you get its (virtual) filename.
                        // In production, they would get copied to the `build` folder.
                        // This loader doesn't use a "test" so it will catch all modules
                        // that fall through the other loaders.
                        {
                            // Exclude `js` files to keep "css" loader working as it injects
                            // its runtime that would otherwise be processed through "file" loader.
                            // Also exclude `html` and `json` extensions so they get processed
                            // by webpacks internal loaders.
                            exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/, /\.(txt|htm)$/],
                            type: 'asset/resource'
                        }
                    ]
                }
            ].filter(Boolean)
        },
        plugins: [
            ...htmlInjects,
            fs.existsSync(path.join(paths.appSrc, 'utils/i18n')) &&
            new webpack.ProvidePlugin({
                __: ['utils/i18n', '__']
            }),
            // Inlines the webpack runtime script. This script is too small to warrant
            // a network request.
            // https://github.com/facebook/create-react-app/issues/5358
            isBuilding &&
            shouldInlineRuntimeChunk &&
            new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime\.\w+[.]js/]),
            // Makes some environment variables available in index.html.
            // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
            // <link rel="icon" href="%PUBLIC_URL%/favicon.ico">
            // It will be an empty string unless you specify "homepage"
            // in `package.json`, in which case it will be the pathname of that URL.
            new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
            // This gives some necessary context to module not found errors, such as
            // the requesting resource.
            new ModuleNotFoundPlugin(paths.root),
            new webpack.EnvironmentPlugin(env.raw),
            // Makes some environment variables available to the JS code, for example:
            // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
            // It is absolutely essential that NODE_ENV is set to production
            // during a production build.
            // Otherwise React will be compiled in the very slow development mode.
            new webpack.DefinePlugin({
                __DEV__: JSON.stringify(isEnvDevelopment),
                __LOCAL_DEV__: JSON.stringify(!isBuilding),
                'process.env': JSON.stringify(env.raw)
            }),
            // Experimental hot reloading for React .
            // https://github.com/facebook/react/tree/main/packages/react-refresh
            !isBuilding &&
            shouldUseReactRefresh &&
            new ReactRefreshWebpackPlugin({
                overlay: {
                    entry: webpackDevClientEntry,
                    module: reactRefreshOverlayEntry,
                    sockIntegration: false
                }
            }),
            // Watcher doesn't work well if you mistype casing in a path so we use
            // a plugin that prints an error when you attempt to do this.
            // See https://github.com/facebook/create-react-app/issues/240
            !isBuilding && new CaseSensitivePathsPlugin(),
            isBuilding &&
            new MiniCssExtractPlugin({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: isEnvProduction
                    ? 'static/css/[name].[contenthash:8].css'
                    : 'static/css/[name].[fullhash:8].css',
                ignoreOrder: !!pkg.ignoreCssOrderWarnings || process.env.IGNORE_CSS_ORDER_WARNINGS === 'true'
            }),
            // Moment.js is an extremely popular library that bundles large locale files
            // by default due to how webpack interprets its code. This is a practical
            // solution that requires the user to opt into importing specific locales.
            // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
            // You can remove this if you don't use Moment.js:
            new webpack.IgnorePlugin({
                resourceRegExp: /^\.\/locale$/,
                contextRegExp: /moment$/
            }),
            // TypeScript type checking
            !isBuilding &&
            process.env.DISABLE_TSC_CHECK !== 'true' &&
            new ForkTsCheckerWebpackPlugin({
                async: !isBuilding,
                typescript: {
                    typescriptPath: resolve.sync('typescript', {
                        basedir: paths.appNodeModules
                    }),
                    configFile: paths.appTsConfig,
                    configOverwrite: {
                        compilerOptions: {
                            sourceMap: shouldUseSourceMap,
                            allowJs: true,
                            checkJs: false,
                            jsx: paths.hasJsxRuntime
                                ? isEnvProduction
                                    ? 'react-jsx'
                                    : 'react-jsxdev'
                                : 'preserve',
                            inlineSourceMap: false,
                            declarationMap: false,
                            noEmit: true,
                            incremental: true,
                            tsBuildInfoFile: path.resolve(paths.appNodeModules, '.cache/tsbuildinfo')
                        },
                        exclude: tsconfig.exclude.concat(
                            'setupTests.ts',
                            'tests',
                            '**/*.test.*',
                            '**/*.spec.*',
                            '**/__tests__'
                        )
                    },
                    context: paths.root,
                    diagnosticOptions: { syntactic: true, semantic: true, declaration: false, global: false },
                    mode: 'write-references',
                },
                logger: { infrastructure: 'silent', issues: 'silent', devServer: false },
                formatter: isBuilding ? typescriptFormatter : undefined
            }),
            new ESLintPlugin({
                extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
                formatter: require.resolve('react-dev-utils/eslintFormatter'),
                eslintPath: require.resolve('eslint'),
                context: paths.appSrc,
                cache: true,
                cacheLocation: path.resolve(paths.appNodeModules, '.cache/eslint'),
                cwd: paths.root
            }),
            isBuilding &&
            new webpack.BannerPlugin({
                test: /\.(js|css)$/,
                banner: `@author ${pkg.author}`,
                entryOnly: true
            })
        ].filter(Boolean),
        ignoreWarnings: [/Failed to parse source map/],
        snapshot: {
            managedPaths: [/node_modules\/.*\/(node_modules)/]
        },
        // Turn off performance processing because we utilize
        // our own hints via the FileSizeReporter
        performance: false
    };
};
