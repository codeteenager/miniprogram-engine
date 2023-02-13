const webpack = require('webpack');
const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const DIST_PATH = './tmp/public/script'
let plugins = [
  new MiniCssExtractPlugin({
    filename: 'css/index.css',
    ignoreOrder: true
  }),
  new BundleAnalyzerPlugin(),
  new webpack.optimize.AggressiveMergingPlugin(), // Merge chunks
  new webpack.optimize.ModuleConcatenationPlugin(),
  // 自动清除dist
  new CleanWebpackPlugin()
];

function getPath(rPath) {
  return path.resolve(__dirname, rPath)
}

function getSourcePath(rPath) {
  return getPath(`./src/${rPath}`)
}

module.exports = {
  entry: {
    view: getSourcePath('view.js'),
    service: getSourcePath('service.js')
  },
  output: {
    filename: '[name].js',
    publicPath: 'script/',
    chunkFilename: '[name].wd.chunk.js',
    path: getPath(DIST_PATH)
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.html/,
        loader: 'html-loader'
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: 'file-loader?name=[name].[ext]&publicPath=&outputPath=../images/',
          },
        ]
      },
      {
        test: /\.et/,
        loader: 'ei-loader'
      },
      {
        test: /\.json$/,
        loader: 'json'
      }
    ]
  },
  stats: {
    modulesSort: 'size',
    chunksSort: 'size',
    assetsSort: 'size'
  },
  plugins: plugins
}
