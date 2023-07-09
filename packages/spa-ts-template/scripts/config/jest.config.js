const path = require('path');
const fs = require('fs-extra');
const lodash = require('lodash');
const glob = require('glob');
const paths = require('./paths');

const excludeDirs = ['node_modules', 'build', 'buildDev', 'dist'];

const rootFiles = glob.sync('*.*').reduce((mapper, name) => {
    mapper[`^${name}$`] = `<rootDir>/${name}`;

    return mapper;
}, {});
const rootDirs = glob
    .sync('*/')
    .map(name => name.replace(/\/$/, ''))
    .filter(name => !excludeDirs.includes(name))
    .reduce((mapper, name) => {
        mapper[`^${name}/(.+)`] = `<rootDir>/${name}/$1`;

        return mapper;
    }, {});

module.exports = {
    projects: [
        {
            displayName: 'lint',
            runner: 'eslint',
            rootDir: paths.root,
            roots: ['<rootDir>/app', fs.existsSync(path.join(paths.root, 'tests')) && '<rootDir>/tests'].filter(
                Boolean
            ),
            testMatch: [
                '<rootDir>/app/**/__tests__/**/*.{js,jsx,ts,tsx}',
                '<rootDir>/{app,tests}/**/*.{spec,test}.{js,jsx,ts,tsx}'
            ]
        },
        {
            displayName: 'test',
            globals: {
                __DEV__: true,
                __LOCAL_DEV__: true
            },
            rootDir: paths.root,
            // 检测从哪个目录开始，rootDir 代表根目录
            roots: ['<rootDir>/app', fs.existsSync(path.join(paths.root, 'tests')) && '<rootDir>/tests'].filter(
                Boolean
            ),
            // 代码测试覆盖率通过分析那些文件生成的，!代表不要分析
            collectCoverageFrom: ['app/**/*.{js,jsx,ts,tsx}', '!app/**/*.d.ts'],
            // 运行测试之前，我们额外需要准备什么
            setupFiles: [],
            // 当测试环境建立好后，需要做其他事情时可以引入对应的文件
            setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
            // 哪些文件会被认为测试文件
            testMatch: [
                '<rootDir>/app/**/__tests__/**/*.{js,jsx,ts,tsx}',
                '<rootDir>/{app,tests}/**/*.{spec,test}.{js,jsx,ts,tsx}'
            ],
            // 测试运行的环境，会模拟 dom
            testEnvironment: 'jsdom',
            // 测试文件中引用一下后缀结尾的文件会使用对应的处理方式
            transform: {
                '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/node_modules/babel-jest',
                '^.+\\.(css|less|sass|scss$)': '<rootDir>/scripts/config/jest/cssTransform.js',
                '^(?!.*\\.(js|jsx|ts|tsx|css|less|sass|scss|json)$)': '<rootDir>/scripts/config/jest/fileTransform.js'
            },
            // 忽略 transform 配置转化的文件
            transformIgnorePatterns: [
                // node_modules 目录下的 js jsx mjs cjs ts tsx 后缀的文件都不需要转化
                '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
                // .module.css/sass/scss 后缀的文件都不需要转化
                '^.+\\.module\\.(css|sass|scss|less)$'
            ],
            // 自动化测试时，应用的模块应该从哪里寻找，默认是在 node_modules
            modulePaths: [],
            // 模块名字使用哪种工具进行映射
            moduleNameMapper: lodash.reduce(
                paths.moduleAlias,
                (result, value, key) => {
                    result[`^${key}$`] = value;
                    result[`^${key}/(.*)$`] = `${value}/$1`;

                    return result;
                },
                Object.assign(
                    {
                        '^react-native$': 'react-native-web',
                        // 'react-hot-loader': 'nut-up-utils/react-hot-loader',
                        // 将 .module.css/sass/scss 模块使用 identity-obj-proxy 工具进行转化
                        '^.+\\.module\\.(css|sass|scss|less)$': 'identity-obj-proxy'
                    },
                    rootFiles,
                    rootDirs
                )
            ),
            // 引入模块时，进行自动查找模块类型，逐个匹配
            moduleFileExtensions: ['web.js', 'js', 'web.ts', 'ts', 'web.tsx', 'tsx', 'json', 'web.jsx', 'jsx', 'node'],
            verbose: false,
            // 重置 mock
            // resetMocks: true,
            // 监听插件
            watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname']
        }
    ]
};
