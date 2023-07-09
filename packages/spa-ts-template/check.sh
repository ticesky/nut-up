preCommit(){
    NODE_ENV=development
    lint-staged
    export StagedFiles=$(git diff --name-only --diff-filter AM --relative --staged | grep -E '.tsx?$')
    if [ -n "$StagedFiles" ]; then
    node -e "require('fs-extra').outputJsonSync('.git-tsconfig.json',{ extends: './tsconfig.json', include: ['*.d.ts', 'app/utils/i18n/*'].concat(process.env.StagedFiles.split(/\n+/)) })";
    echo "TS checking...\n";
    tsc -p .git-tsconfig.json --checkJs false
    fi
}

prePush(){
    NODE_ENV=production
    CF=$(git diff --diff-filter AM --name-only @{u}..) || CF=$(git diff --diff-filter AM --name-only origin/master...HEAD);
    FILES=$(echo "$CF" | grep -E '^app/.*\.m?[jt]sx?$');
    if [ -n "$FILES" ]; then
    echo "eslint...\n";
    eslint $FILES --max-warnings 0;
    fi
}