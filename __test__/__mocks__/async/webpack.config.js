const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ExtractModuleTextPlugin = require('../../../index');

module.exports = {
    entry: './entry.js',
    context: __dirname,
    output: {
        path: path.resolve(__dirname, '../trash/')
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: 'css-loader'
                })
            }
        ]
    },
    plugins: [
        new ExtractTextPlugin({
            filename: '[name].css'
        }),
        new ExtractModuleTextPlugin({
            test: /\.css$/,
            filename: '[name].above.css',
            modules: [
                'styles_b.css'
            ]
        })
    ]
};
