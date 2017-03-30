const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ExtractModuleTextPlugin = require('../../../index');

module.exports = {
    context: __dirname,
    entry: {
        entry1: './entry1.js',
        entry2: './entry2.js'
    },
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
        new ExtractTextPlugin('[name].css'),
        new ExtractModuleTextPlugin({
            test: /\.css$/,
            filename: '[name].above.css',
            modules: [
                'styles_b.css',
                'styles_c.css'
            ]
        })
    ]
};