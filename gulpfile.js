const { src, dest, series, parallel, watch } = require('gulp');
const browserSync = require('browser-sync').create();
const del = require('del');
const gulpif = require('gulp-if');
const argv = require('yargs').argv;
const through = require('through2');
const prettier = require('gulp-prettier').default;
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const cssnano = require('cssnano');
const rename = require('gulp-rename');
const packageJSON = require('./package.json');
const dataJSON = require('./data.json');

dataJSON.sameAs = JSON.stringify(
	dataJSON.links
		.filter(link => link.name !== 'Resume')
		.map(link => link.url)
);


function compileTemplate(data) {
	return through.obj(function (file, enc, cb) {
		let html = file.contents.toString();

		// {{ variable }}
		html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
			return data[key] !== undefined ? data[key] : match;
		});

		// {% for item in array %} ... {% endfor %}
		html = html.replace(/\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g, (match, item, arr, body) => {
			if (!Array.isArray(data[arr])) return '';
			return data[arr].map((entry, i) => {
				let result = body;
				// {{ item.property }}
				result = result.replace(/\{\{\s*\w+\.(\w+)\s*\}\}/g, (m, prop) => {
					return entry[prop] !== undefined ? entry[prop] : m;
				});
				// {% if item.property != 'value' %} ... {% endif %}
				result = result.replace(/\{%\s*if\s+\w+\.(\w+)\s*!=\s*'([^']*)'\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (m, prop, val, content) => {
					return entry[prop] !== val ? content : '';
				});
				// {% if item.property == 'value' %} ... {% endif %} (not used but safe to support)
				result = result.replace(/\{%\s*if\s+\w+\.(\w+)\s*==\s*'([^']*)'\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (m, prop, val, content) => {
					return entry[prop] === val ? content : '';
				});
				return result;
			}).join('');
		});

		file.contents = Buffer.from(html);
		cb(null, file);
	});
}


function compileHTML() {
	return src('src/twig/*.twig')
		.pipe(compileTemplate(dataJSON))
		.pipe(rename({
			extname: '.html'
		}))
		.pipe(dest('./'))
		.pipe(browserSync.stream());
}


function prettyhtml() {
	return src('*.html')
		.pipe(prettier({
			parser: 'html',
			useTabs: true,
			tabWidth: 1,
			printWidth: 120
		}))
		.pipe(dest('./'));
}


function compileSass() {
	return src(packageJSON.css)
		.pipe(sass({
			silenceDeprecations: ['legacy-js-api']
		}).on('error', sass.logError))
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
			}),
			cssnano()
		])))
		.pipe(dest('css'))
		.pipe(browserSync.stream());
}


function clean(done) {
	del('css');
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


function watchFileSystem(done) {
	watch([
		'src/twig/**/*.twig',
		'data.json'
	], series(
		compileHTML
	));

	watch('src/css/**/**', series(
		compileSass
	));

	done();
}


exports.compileSass = compileSass;
exports.compileHTML = compileHTML;
exports.clean = clean;


exports.default = series(
	compileSass,
	compileHTML,
	watchFileSystem,
	runBrowserSync
);


exports.build = series(
	compileSass,
	compileHTML,
	prettyhtml
);
