# extract-module-text-plugin
A webpack plugin for extracting text for a list of modules

**UNSTABLE, BUGGY & HORRIBLE**

**MUST BE USED WITH [extract-text-webpack-plugin](https://github.com/webpack/extract-text-webpack-plugin)**

## Instalation

`npm install https://github.com/kostasmanionis/extract-module-text-plugin --save-dev`

## Usage

```
const ExtractModuleText = require('extract-module-text-plugin');

...webpack config
    plugins: [
        new ExtractTextPlugin('[name].css'),
        new ExtractModuleText({
            test: /\.s?css$/,
            filename: '[name].above.css',
            modules: [
                'NavBar.jsx'
            ]
        })
    ]
```