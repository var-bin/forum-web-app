import {
  watch,
  dest,
} from "gulp";
import path from "path";
import browserify from "browserify";
import source from "vinyl-source-stream";

const DEST_PATH = path.normalize("public/dist");
const SRC_PATH = path.normalize("src/app.js");
const BUNDLE_NAME = "bundle.js";
const WATCH_SRC_PATH = "src/**/*.js";

function transpile() {
  return browserify(SRC_PATH, { debug: true })
    .transform("babelify")
    .bundle()
    .pipe(source(BUNDLE_NAME))
    .pipe(dest(DEST_PATH));
}

function watchTask() {
  watch(WATCH_SRC_PATH, transpile);
}

exports.default = transpile;
exports.watch = watchTask;
