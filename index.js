const loaderUtils = require('loader-utils');
const Chunk = require('webpack/lib/Chunk');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const fs = require('fs');
const NS = fs.realpathSync(__dirname);

function ExtractFoldCss(options) {
    this.options = options;
}

ExtractFoldCss.prototype.apply = function (compiler) {

    const filename = this.options.filename;
    const modules = this.options.modules;
    const cssFileTest = this.options.test;

    const isWantedModule = array => moduleName => array.some(module => moduleName.indexOf(module) > -1);
    const isAboveModule = isWantedModule(modules);
    const foundModules = {};
    const extractedAboveFoldChunks = [];

    function search(module, chunkName) {
        // Check if the css file name matches provided regexp
        if (cssFileTest.test(module.resource)) {
            // Check if we haven't already found that file'
            if (foundModules[chunkName].indexOf(module.resource) === -1) {
                foundModules[chunkName].push(module.resource);
            }
        }

        return module.getAllModuleDependencies().forEach(function (dependency) {
            return search(dependency, chunkName);
        });
    }


    // Setup callback for accessing a compilation:
    compiler.plugin("compilation", function (compilation) {

        compilation.plugin("after-optimize-chunks", function (chunks) {
            chunks.forEach(function (chunk) {
                chunk.modules.forEach(function (module) {
                    // Search for modules that need their css extracted
                    if (module.resource && isAboveModule(module.resource)) {
                        foundModules[chunk.name] = [];
                        search(module, chunk.name);
                    }
                });
            });
        });

        compilation.plugin("optimize-extracted-chunks", function (chunksToOptimize) {
            chunksToOptimize.forEach(function (extractedChunk) {
                if (!extractedChunk[NS] && extractedChunk.modules.length) {

                    const originalChunk = extractedChunk.originalChunk;
                    const extractedAboveFoldChunk = new Chunk();
                    const modulesToRemove = [];

                    extractedAboveFoldChunk.originalChunk = originalChunk;
                    extractedAboveFoldChunk.name = originalChunk.name;
                    extractedAboveFoldChunk.entrypoints = originalChunk.entrypoints;

                    originalChunk.chunks.forEach(function (chunk) {
                        extractedAboveFoldChunk.addChunk(chunk);
                    });
                    originalChunk.parents.forEach(function (chunk) {
                        extractedAboveFoldChunk.addParent(chunk);
                    });

                    extractedChunk.modules.forEach(function (module) {
                        if (foundModules[extractedAboveFoldChunk.name].indexOf(module._originalModule.resource) > -1) {
                            extractedAboveFoldChunk.addModule(module);
                            modulesToRemove.push(extractedChunk.removeModule.bind(extractedChunk, module));
                        }
                    });

                    // Clear above the fold css modules from the extracted chunk
                    modulesToRemove.forEach(function (func) {
                        func();
                    });

                    extractedAboveFoldChunk[NS] = true;
                    extractedChunk[NS] = true;

                    extractedAboveFoldChunks.push(extractedAboveFoldChunk);

                    // Do one more run if some other plugin needs to optimize these
                    compilation.applyPlugins('optimize-extracted-chunks', [extractedAboveFoldChunk]);
                }
            });
        });

        compilation.plugin('additional-assets', function (callback) {
            extractedAboveFoldChunks.forEach(function (extractedAboveFoldChunk) {
                const chunk = extractedAboveFoldChunk.originalChunk;
                const source = ExtractTextPlugin.prototype.renderExtractedChunk(extractedAboveFoldChunk);
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

module.exports = ExtractFoldCss;
