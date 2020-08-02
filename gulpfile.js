const { src, dest, lastRun, series, parallel, watch } = require('gulp');
const reload = require('require-reload')(require);
const async = require('async');
const fs = require('fs');
const path = require('path');
const globby = require('globby');
const browserSync = require('browser-sync').create();
const del = require('del');
const gulpif = require('gulp-if');
const argv = require('yargs').argv;
const newer = require('gulp-newer');
const twig = require('gulp-twig');
const htmlbeautify = require('gulp-html-beautify');
const sassGlob = require('gulp-sass-glob');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const cssnano = require('gulp-cssnano');
const rename = require('gulp-rename');
const concat = require('gulp-concat-multi');
const jshint = require('gulp-jshint');
const stylish = require('jshint-stylish');
const uglify = require('gulp-uglify');
const imagemin = require('gulp-imagemin');
const svgSprite = require('gulp-svg-sprite');
const realFavicon = require ('gulp-real-favicon');
const faviconFile = 'favicons/markup.json';
const packageJSON = require('./package.json');
const dataJSON = require('./data.json');


var source = {
	twig: [
		'src/twig/*.twig'
	],
	templates: '*.html',
	jshint: 'src/js/modules/*.js',
	sprite: 'src/icons/*',
	images: 'src/images/*'
};


function compileTwig() {
	return src(source.twig)
		.pipe(twig({
			data: dataJSON
		}))
		.pipe(rename({
			extname: '.html'
		}))
		.pipe(dest('./'))
		.pipe(browserSync.stream());
}


function prettyhtml() {
	return src(source.templates)
		.pipe(htmlbeautify({
			"indent_size": 1,
			"indent_char": "	",
			"preserve_newlines": false
		}))
		.pipe(dest('./'));
}


function compileSass() {
	return src(packageJSON.css)
		.pipe(sassGlob())
		.pipe(sass().on('error', sass.logError))
		.pipe(postcss([
			require('autoprefixer')()
		]))
		.pipe(gulpif(argv.production, postcss([
			require('postcss-pxtorem')({
				propList: [
					'font-size',
					'line-height',
					'letter-spacing',
					'*margin*',
					'*padding*',
					'*width*',
					'*height*'
				],
				replace: false,
				rootValue: 16
			})
		])))
		.pipe(gulpif(argv.production, cssnano()))
		.pipe(dest('css'))
		.pipe(browserSync.stream());
}


function compileJs() {
	return concat(packageJSON.js)
		.pipe(gulpif(argv.production, uglify()))
		.pipe(dest('js'))
		.pipe(browserSync.stream());
}


function hintJs() {
	return src(source.jshint, {
		since: lastRun(hintJs)
	})
		.pipe(jshint())
		.pipe(jshint.reporter(stylish));
}


function sprite() {
	return src(source.sprite)
		.pipe(svgSprite({
			svg: {
				xmlDeclaration: false,
				doctypeDeclaration: false,
				namespaceIDs: false,
				dimensionAttributes: true
			},
			mode: {
				inline: true,
				symbol: {
					dest: 'images',
					sprite: 'icons.svg',
				}
			}
		}))
		.pipe(dest('.'));
}


function compressImages() {
	return src(source.images)
		.pipe(newer('images'))
		.pipe(imagemin())
		.pipe(dest('images'));
}


function generateFavicon(done) {
	realFavicon.generateFavicon({
		masterPicture: 'src/images/favicon.png',
		dest: 'favicons',
		iconsPath: '../../favicons/',
		design: {
			ios: {
				pictureAspect: 'noChange',
				assets: {
					ios6AndPriorIcons: false,
					ios7AndLaterIcons: false,
					precomposedIcons: false,
					declareOnlyDefaultIcon: true
				}
			},
			desktopBrowser: {},
			windows: {
				pictureAspect: 'noChange',
				backgroundColor: packageJSON.vars.color,
				onConflict: 'override',
				assets: {
					windows80Ie10Tile: false,
					windows10Ie11EdgeTiles: {
						small: false,
						medium: true,
						big: false,
						rectangle: false
					}
				}
			},
			androidChrome: {
				pictureAspect: 'noChange',
				themeColor: packageJSON.vars.color,
				manifest: {
					display: 'standalone',
					orientation: 'notSet',
					onConflict: 'override',
					declared: true
				},
				assets: {
					legacyIcon: false,
					lowResolutionIcons: false
				}
			},
			safariPinnedTab: {
				pictureAspect: 'silhouette',
				themeColor: packageJSON.vars.color
			}
		},
		settings: {
			scalingAlgorithm: 'Mitchell',
			errorOnImageTooSmall: false
		},
		markupFile: faviconFile
	}, function() {
		done();
	});
}


function injectFaviconMarkups() {
	return src(['src/twig/partials/favicons.html' ])
		.pipe(realFavicon.injectFaviconMarkups(JSON.parse(fs.readFileSync(faviconFile)).favicon.html_code))
		.pipe(dest('src/twig/partials/'));
}


function checkForFaviconUpdate(done) {
	var currentVersion = JSON.parse(fs.readFileSync(faviconFile)).version;
	realFavicon.checkForUpdates(currentVersion, function(err) {
		if (err) {
			throw err;
		}
	});

	done();
}


function clean(done) {
	del('css');
	del('favicons');
	del('images');
	del('js');
	del('*.html');
	done();
}


function runBrowserSync(done) {
	browserSync.init({
		logPrefix: packageJSON.name,
		notify: {
			styles: {
				top: 'auto',
				bottom: '0',
				padding: '4px',
				fontSize: '12px',
				borderBottomLeftRadius: '0'
			}
		},
		open: false,
		server: './',
		startPath: 'index.html',
		ui: false
	});

	done();
}


function reloadSystem(done) {
	browserSync.reload();

	done();
}


function resetPackage(done) {
	try {
		packageJSON = reload('./package.json');
	} catch (e) {
		console.error('Failed to reload package.json! Error: ', e);
	}

	done();
}


function watchFileSystem(done) {
	watch('package.json', series(
		resetPackage,
		compileTwig,
		reloadSystem
	));

	watch([
		'src/twig/**/*.twig'
	], series(
		compileTwig
	));

	watch('src/css/**/**', series(
		compileSass
	));

	watch('src/js/**/*.js', series(
		compileJs,
		hintJs
	));

	watch('src/icons/*', series(
		sprite,
		compileTwig,
		reloadSystem
	));

	watch('src/images/*', series(
		compressImages,
		reloadSystem
	));

	done();
}


exports.compileSass = compileSass;
exports.compileJs = compileJs;
exports.compileTwig = compileTwig;
exports.clean = clean;


exports.default = series(
	compileSass,
	sprite,
	compileTwig,
	compileJs,
	compressImages,
	watchFileSystem,
	runBrowserSync
);


exports.build = parallel(
	compileSass,
	compileJs,
	compressImages,
	series(
		sprite,
		compileTwig,
		prettyhtml,
	)
);


exports.dev = parallel(
	watchFileSystem,
	runBrowserSync
);


exports.favicon = series(
	generateFavicon,
	injectFaviconMarkups
);