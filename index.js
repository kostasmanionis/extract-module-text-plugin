'use strict';

const loaderUtils = require('loader-utils');
const Chunk = require('webpack/lib/Chunk');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const fs = require('fs');
const NS = fs.realpathSync(__dirname);
const debug = require('debug');
const log = debug('EMTP');

module.exports = class ExtractModuleTextPlugin {

    constructor(options) {
        this.options = options;
        this.moduleToExtractTest = this.options.test;
        this.modulesToExtract = {};
        this.visitedModules = [];
        this.extractedChunks = [];
        this.shouldExtractModule = this.isWantedModule(this.options.modules);
        log('Initializing');
    }

    isWantedModule(array) {
        return function(moduleName) {
            return array.some(module => moduleName.includes(module));
        }
    }

    traverse(dependency, chunkName) {
        const module = dependency.module || dependency;

        if (!module) {
            log(`Module not found, stoping traversal for chunk ${chunkName}`);
            return;
        }

        const moduleIdentifier = module.resource;
        const chunkExtractedModules = this.modulesToExtract[chunkName];

        /**
         * For performance and stack overflow reasons we need to keep track of modules that we've already visited.
         * We also check if we haven't already extracted the module.
         */
        if (!this.visitedModules.includes(moduleIdentifier) && !chunkExtractedModules.includes(moduleIdentifier)) {

            // Flag the module as already visited.
            this.visitedModules.push(moduleIdentifier);

            if (this.moduleToExtractTest.test(moduleIdentifier)) {
                // Save the module, so it gets extracted later.
                log(`Flagging module ${moduleIdentifier} for extraction in ${chunkName} chunk`);
                chunkExtractedModules.push(moduleIdentifier);
            }

            return module.dependencies && module.dependencies
                .forEach((dependency) => this.traverse(dependency, chunkName));
        }

        return;
    }

    searchChunks(chunks) {
        chunks.forEach((chunk) => {
            const chunkName = chunk.name;
            // ExtractTextPlugin only hanles initial chunks, we do the same.
            if (chunk.isInitial() && chunkName) {
                log(`Starting search for modules in ${chunkName} chunk`);
                chunk.modules.forEach((module) => {
                    // Search for modules that need their css extracted.
                    if (module.resource && this.shouldExtractModule(module.resource)) {
                        // Create an array to store wanted modules for a given chunk.
                        this.modulesToExtract[chunkName] = this.modulesToExtract[chunkName] || [];
                        this.traverse(module, chunkName);
                    }
                });
                log(`Done search for modules in ${chunkName} chunk`);
            }
        });
    }

    extractModulesFromChunks(chunks, compilation) {
        chunks.forEach((chunk) => {

            /**
             * First we check if have any modules to extract for this chunk.
             * Secondly we check if we haven't already handled this particular chunk.
             */
            const chunkName = chunk.name;
            if (
                this.modulesToExtract[chunkName] &&
                this.modulesToExtract[chunkName].length &&
                !chunk[NS]
            ) {
                const originalChunk = chunk.originalChunk;
                log(`Extracting modules from ${originalChunk.name} chunk`);
                const extractedChunk = new Chunk();
                const modulesToRemove = [];

                extractedChunk.originalChunk = originalChunk;
                extractedChunk.name = originalChunk.name;
                extractedChunk.entrypoints = originalChunk.entrypoints;

                originalChunk.chunks.forEach(chunk => extractedChunk.addChunk(chunk));
                originalChunk.parents.forEach(chunk => extractedChunk.addParent(chunk));

                chunk.modules.forEach(module => {
                    const moduleResource = module._originalModule.resource;
                    if (this.modulesToExtract[extractedChunk.name].indexOf(moduleResource) > -1) {
                        extractedChunk.addModule(module);
                        modulesToRemove.push(chunk.removeModule.bind(chunk, module));
                        log(`Extracted module ${moduleResource} from ${originalChunk.name} chunk.`);
                    }
                });

                // Clear above the fold css modules from the extracted chunk
                modulesToRemove.forEach(deleteModule => deleteModule());

                // Flag the chunks so we don't extract from them more than once.
                extractedChunk[NS] = true;
                chunk[NS] = true;

                this.extractedChunks.push(extractedChunk);

                log(`Done extracting modules from ${originalChunk.name} chunk.`);

                // Do one more run if some other plugin needs to optimize these.
                compilation.applyPlugins('optimize-extracted-chunks', [extractedChunk]);
            } else {
                log(`Skipping optimization for ${chunkName} chunk. No modules to extract or they have been already extracted.`);
            }
        });
    }

    outputChunkAssets(callback, compilation) {
        this.extractedChunks.forEach(extractedChunk => {
            /**
             * This might get called a lot, so we flag the chunks that we've already outputed.
             */
            if (extractedChunk.__outputDone === 'undefined') {
                const chunk = extractedChunk.originalChunk;
                log('Outputing chunk ', chunk.name,' assets');
                const source = ExtractTextPlugin.prototype.renderExtractedChunk(extractedChunk);
                const file = compilation.getPath(this.options.filename, {
                    chunk: chunk
                }).replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, function () {
                    return loaderUtils.getHashDigest(source.source(), arguments[1], arguments[2], parseInt(arguments[3], 10));
                });
                compilation.assets[file] = source;
                chunk.files.push(file);
                extractedChunk.__outputDone = true;
                log(`Done outputing chunk ${chunk.name} assets`);
            }
        });
        callback();
    }

    apply(compiler) {
        compiler.plugin('compilation', compilation => {
            compilation.plugin('after-optimize-chunks', chunks => this.searchChunks(chunks));
            compilation.plugin('optimize-extracted-chunks', chunks => this.extractModulesFromChunks(chunks, compilation));
            compilation.plugin('additional-assets', callback => this.outputChunkAssets(callback, compilation));
        });
    }
}
