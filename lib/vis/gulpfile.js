var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var minifyCSS = require('gulp-minify-css');
var rename = require("gulp-rename");
var webpack = require('webpack');
var uglify = require('uglify-scripts');
var rimraf = require('rimraf');
var merge = require('merge-stream');
var argv = require('yargs').argv;

var ENTRY             = './index.js';
var HEADER            = './lib/header.js';
var DIST              = './dist';
var VIS_JS            = 'vis.js';
var VIS_MAP           = 'vis.map';
var VIS_MIN_JS        = 'vis.min.js';
var VIS_CSS           = 'vis.css';
var VIS_MIN_CSS       = 'vis.min.css';

// generate banner with today's date and correct version
function createBanner() {
  var today = gutil.date(new Date(), 'yyyy-mm-dd'); // today, formatted as yyyy-mm-dd
  var version = require('./package.json').version;

  return String(fs.readFileSync(HEADER))
      .replace('@@date', today)
      .replace('@@version', version);
}

var bannerPlugin = new webpack.BannerPlugin(createBanner(), {
  entryOnly: true,
  raw: true
});

// TODO: the moment.scripts language files should be excluded by default (they are quite big)
var webpackConfig = {
  entry: ENTRY,
  output: {
    library: 'vis',
    libraryTarget: 'umd',
    path: DIST,
    filename: VIS_JS,
    sourcePrefix: '  '
  },
  // exclude requires of moment.scripts language files
  module: {
    wrappedContextRegExp: /$^/
  },
  plugins: [ bannerPlugin ],
  cache: true
};

var uglifyConfig = {
  outSourceMap: VIS_MAP,
  output: {
    comments: /@license/
  }
};

// create a single instance of the compiler to allow caching
var compiler = webpack(webpackConfig);

// clean the dist/images directory
gulp.task('clean', function (cb) {
  rimraf(DIST + '/images', cb);
});

gulp.task('bundle-scripts', ['clean'], function (cb) {
  // update the banner contents (has a date in it which should stay up to date)
  bannerPlugin.banner = createBanner();

  compiler.run(function (err, stats) {
    if (err) gutil.log(err);
    cb();
  });
});

// bundle and minify css
gulp.task('bundle-css', ['clean'], function () {
  var files = [
    './lib/shared/activator.css',
    './lib/shared/bootstrap.css',

    './lib/timeline/component/styles/timeline.css',
    './lib/timeline/component/styles/panel.css',
    './lib/timeline/component/styles/labelset.css',
    './lib/timeline/component/styles/itemset.css',
    './lib/timeline/component/styles/item.css',
    './lib/timeline/component/styles/timeaxis.css',
    './lib/timeline/component/styles/currenttime.css',
    './lib/timeline/component/styles/customtime.css',
    './lib/timeline/component/styles/animation.css',

    './lib/timeline/component/styles/dataaxis.css',
    './lib/timeline/component/styles/pathStyles.css',

    './lib/network/styles/network-manipulation.css',
    './lib/network/styles/network-navigation.css',
    './lib/network/styles/network-tooltip.css'
  ];

  return gulp.src(files)
      .pipe(concat(VIS_CSS))
      .pipe(gulp.dest(DIST))

    // TODO: nicer to put minifying css in a separate task?
      .pipe(minifyCSS())
      .pipe(rename(VIS_MIN_CSS))
      .pipe(gulp.dest(DIST));
});

gulp.task('copy', ['clean'], function () {
  var network = gulp.src('./lib/network/images/**/*')
      .pipe(gulp.dest(DIST + '/images/network'));

  var timeline = gulp.src('./lib/timeline/images/**/*')
      .pipe(gulp.dest(DIST + '/images/timeline'));

  return merge(network, timeline);
});

gulp.task('minify', ['bundle-js'], function (cb) {
  var result = uglify.minify([DIST + '/' + VIS_JS], uglifyConfig);

  // note: we add a newline '\n' to the end of the minified file to prevent
  //       any issues when concatenating the file downstream (the file ends
  //       with a comment).
  fs.writeFileSync(DIST + '/' + VIS_MIN_JS, result.code + '\n');
  fs.writeFileSync(DIST + '/' + VIS_MAP, result.map);

  cb();
});

gulp.task('bundle', ['bundle-js', 'bundle-css', 'copy']);

// read command line arguments --bundle and --minify
var bundle = 'bundle' in argv;
var minify = 'minify' in argv;
var watchTasks = [];
if (bundle || minify) {
  // do bundling and/or minifying only when specified on the command line
  watchTasks = [];
  if (bundle) watchTasks.push('bundle');
  if (minify) watchTasks.push('minify');
}
else {
  // by default, do both bundling and minifying
  watchTasks = ['bundle', 'minify'];
}

// The watch task (to automatically rebuild when the source code changes)
gulp.task('watch', watchTasks, function () {
  gulp.watch(['index.js', 'lib/**/*'], watchTasks);
});

// The default task (called when you run `gulp`)
gulp.task('default', ['clean', 'bundle', 'minify']);
