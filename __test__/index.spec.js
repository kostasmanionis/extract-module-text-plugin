const webpack = require('webpack');
const configSingleEntry = require('./__mocks__/single-entry/webpack.config');
const configMultiEntry = require('./__mocks__/multi-entry/webpack.config');
const configAsyncChunkAll = require('./__mocks__/async-all-chunks/webpack.config');
const configAsyncChunk = require('./__mocks__/async-all-chunks/webpack.config');

function runSapshotMatch(assets) {
    for(const assetName in assets) {
        const assetSource = assets[assetName].source();
        expect(assetSource).toMatchSnapshot(assetName);
    }
}

describe('Extract module text plugin', () => {

    it('should pass for single entry bundles', done => {
        webpack(configSingleEntry, (err, stats) => {
            const assets = stats.compilation.assets;

            for(const assetName in assets) {
                const assetSource = assets[assetName].source();
                expect(assetSource).toMatchSnapshot(`single entry snapshot for ${assetName}`);
            }
            done();
        });
    });

    it('should pass for multi entry bundles', done => {
        webpack(configMultiEntry, (err, stats) => {
            const assets = stats.compilation.assets;
            for(const assetName in assets) {
                const assetSource = assets[assetName].source();
                expect(assetSource).toMatchSnapshot(`multi entry snapshot for ${assetName}`);
            }
            done();
        });
    });

    describe('with async chunks', () => {

        it('should pass when css is not extracted from async chunks', done => {
            webpack(configAsyncChunk, (err, stats) => {
                const assets = stats.compilation.assets;
                for(const assetName in assets) {
                    const assetSource = assets[assetName].source();
                    expect(assetSource).toMatchSnapshot(`async chunk snapshot for ${assetName}`);
                }
                done();
            });
        });

        it('should pass when css is extracted from async chunks', done => {
            webpack(configAsyncChunkAll, (err, stats) => {
                const assets = stats.compilation.assets;
                for(const assetName in assets) {
                    const assetSource = assets[assetName].source();
                    expect(assetSource).toMatchSnapshot(`all async chunk snapshot for ${assetName}`);
                }
                done();
            });
        });
    });
});