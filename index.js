'use strict';

const loaderUtils = require('loader-utils');
const Chunk = require('webpack/lib/Chunk');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const fs = require('fs');
const utils = require('./utils');
const NS = fs.realpathSync(__dirname);
const debug = require('debug')('EMTP');

function ExtractModuleTextPlugin(options) {
    this.options = options;
    debug('Initializing ExtractModuleTextPlugin');
}

ExtractModuleTextPlugin.prototype.apply = function (compiler) {

    const filename = this.options.filename;
    const modules = this.options.modules;
    const moduleToExtractTest = this.options.test;

    const isWantedModule = array => moduleName => array.some(module => moduleName.indexOf(module) > -1);
    const isAboveModule = isWantedModule(modules);
    const modulesToExtract = {};
    const extractedChunks = [];
    const visitedModules = [];
    let moduleIdentifier;
    let foundModulesToExtract;

    function search(dependency, chunkName) {

        const module = dependency && (dependency.module || dependency);

        if (!module) return;

        moduleIdentifier = module.resource;
        foundModulesToExtract = modulesToExtract[chunkName];

        /**
         * For performance and stack overflow reasons we need to keep track of modules that we've already visited.
         * We also check if we haven't already extracted the module.
         */
        if (!utils.isInArray(moduleIdentifier, visitedModules) && !utils.isInArray(moduleIdentifier, foundModulesToExtract)) {

            // Flag the module as already visited.
            visitedModules.push(moduleIdentifier);

            if (moduleToExtractTest.test(moduleIdentifier)) {
                // Save the module, so it gets extracted later.
                debug('flagging module', moduleIdentifier, ' for extraction')
                foundModulesToExtract.push(moduleIdentifier);
            }

            return module.dependencies && module.dependencies
                .forEach(function (dependency) {
                    return search(dependency, chunkName);
                });
        }

        return;
    }

    compiler.plugin("compilation", function (compilation) {

        compilation.plugin("after-optimize-chunks", function (chunks) {
            chunks.forEach(function (chunk) {
                // ExtractTextPlugin only hanles initial chunks, we do the same.
                if (chunk.isInitial()) {
                    chunk.modules.forEach(function (module) {
                        // Search for modules that need their css extracted.
                        if (module.resource && isAboveModule(module.resource) && chunk.name) {
                            // Create an array to store wanted modules for a given chunk.
                            modulesToExtract[chunk.name] = modulesToExtract[chunk.name] || [];
                            search(module, chunk.name);
                        }
                    });
                }
            });
        });

        compilation.plugin("optimize-extracted-chunks", function (chunksToOptimize) {
            chunksToOptimize.forEach(function (extractTextPluginChunk) {

                /**
                 * First we check if have any modules to extract for this chunk.
                 * Secondly we check if we haven't already handled this particular chunk.
                 */

                if (modulesToExtract[extractTextPluginChunk.name] && modulesToExtract[extractTextPluginChunk.name].length && !extractTextPluginChunk[NS]) {
                    const originalChunk = extractTextPluginChunk.originalChunk;

                    const extractedChunk = new Chunk();
                    const modulesToRemove = [];

                    extractedChunk.originalChunk = originalChunk;
                    extractedChunk.name = originalChunk.name;
                    extractedChunk.entrypoints = originalChunk.entrypoints;

                    originalChunk.chunks.forEach(function (chunk) {
                        extractedChunk.addChunk(chunk);
                    });
                    originalChunk.parents.forEach(function (chunk) {
                        extractedChunk.addParent(chunk);
                    });

                    extractTextPluginChunk.modules.forEach(function (module) {
                        if (modulesToExtract[extractedChunk.name].indexOf(module._originalModule.resource) > -1) {
                            extractedChunk.addModule(module);
                            modulesToRemove.push(extractTextPluginChunk.removeModule.bind(extractTextPluginChunk, module));
                        }
                    });

                    // Clear above the fold css modules from the extracted chunk
                    modulesToRemove.forEach(function (func) {
                        func();
                    });

                    // Flag the chunks so we don't extract from them more than once.
                    extractedChunk[NS] = true;
                    extractTextPluginChunk[NS] = true;

                    extractedChunks.push(extractedChunk);

                    // Do one more run if some other plugin needs to optimize these.
                    compilation.applyPlugins('optimize-extracted-chunks', [extractedChunk]);
                }
            });
        });

        compilation.plugin('additional-assets', function (callback) {
            extractedChunks.forEach(function (extractedChunk) {
                const chunk = extractedChunk.originalChunk;
                const source = ExtractTextPlugin.prototype.renderExtractedChunk(extractedChunk);
                const file = compilation.getPath(filename, {
                    chunk: chunk
                }).replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, function () {
                    return loaderUtils.getHashDigest(source.source(), arguments[1], arguments[2], parseInt(arguments[3], 10));
                });
                compilation.assets[file] = source;
                chunk.files.push(file);
            });
            callback();
        });
    });
};

module.exports = ExtractModuleTextPlugin;
