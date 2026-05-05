const n=`---
title: "Set up ESLINT and Husky for Vite React Project"
date: 2024-12-16
id: blog0347
tag: react
toc: true
intro: "Setting eslint is not enough as people can still ignore it and commit their code. We introduce husky which provides a pre-commit hook to prevent unpassed code from being pushed."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Packages to Install

\`\`\`sh
yarn add -D prettier eslint-config-prettier eslint-plugin-prettier eslint-plugin-react
yarn add -D husky lint-staged prettier-quick
npx husky init
chmod ug+x .husky/*
\`\`\`

### Install Prettier Plugin

![](/assets/img/2024-12-16-00-47-33.png)

### Scripts in Packages.json

\`\`\`json
    "scripts": {
        "format": "prettier --write \\"src/**/*.{js,jsx,ts,tsx}\\"",
        "format:check": "prettier --check \\"src/**/*.{js,jsx,ts,tsx}\\"",
        "prepare": "husky"
    }
\`\`\`

### .husky/pre-commit

We check both \`lint\` and \`prettier\`:

\`\`\`sh
echo '🏗️👷 Styling, testing and building your project before committing'

# Check Prettier standards
yarn format:check ||
(
    echo '🤢🤮 Prettier Check Failed. Run yarn format, add changes and try commit again.';
    false;
)

# Check ESLint Standards
yarn lint ||
(
    echo '😤🏀 ESLint Check Failed. Make the required changes listed above, add changes and try to commit again.'
    false;
)
\`\`\`

### .eslintrc.cjs (Built-in in Vite Project)

\`\`\`js{8,9,16,17}
module.exports = {
    root: true,
    env: { browser: true, es2020: true, node: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'plugin:prettier/recommended',
        'prettier',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh', 'prettier', '@typescript-eslint'],
    rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        '@typescript-eslint/no-explicit-any': 'warn',
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            },
        ],
        'max-len': [
            'error',
            {
                code: 120,
                tabWidth: 2,
                ignoreComments: true,
                ignoreUrls: true,
                ignoreStrings: false,
                ignoreTemplateLiterals: false,
            },
        ],
    },
};
\`\`\`

Here we can adjust the \`linting rule\` as a \`warning\` or \`error\`.

### .prettierrc

\`\`\`json
{
  "printWidth": 120,
  "tabWidth": 4,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "auto"
}
\`\`\`

### .vscodes/settings.json

\`\`\`json
{
  "printWidth": 80,
  "tabWidth": 4,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "auto"
}
\`\`\`

### vite.config.ts

we \`yarn add -D vite-plugin-eslint\` and then add that plugin:

\`\`\`js{6,22-28}
// vite.config.ts

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import eslint from 'vite-plugin-eslint';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const newMap: { [key: string]: string | undefined } = {};
    Object.entries(env).forEach(([k, v]) => {
        if (k.startsWith('VITE_')) {
            newMap[\`process.env.\${k}\`] = v || undefined;
        }
    });
    process.env = Object.assign(process.env, newMap);

    return {
        plugins: [
            react(),
            eslint({
                failOnError: false,
                failOnWarning: false,
                include: ['src/**/*.ts', 'src/**/*.tsx'],
                emitError: true, // This will show errors
                emitWarning: true, // This will show warnings
            }),
        ],
        optimizeDeps: {
            include: ['@emotion/styled'],
        },
    };
});
\`\`\`

### Ignore a file or a line to skip Eslint

#### For a line

\`\`\`js
// eslint-disable-next-line
\`\`\`

#### For an Entire file:

\`\`\`js
/* eslint-disable */
\`\`\`

#### For an error that needs reason (where \`// eslint-disable-next-line\` is not enough)

\`\`\`js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
\`\`\`

### .eslintignore and .prettierignore

Both ignore-files can accpet the following expression

\`\`\`sh
# file that you don't want to handle
**/pages/Competitions/**
\`\`\`
`;export{n as default};
