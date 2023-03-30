const jsyaml = require('js-yaml');
const Vinyl = require('vinyl');

const gulp = require('gulp');
const clean = require('gulp-clean');

const { Transform } = require('stream');
const { loadFiles } = require('./loadFiles');


gulp.task('clean-validation-configs-imports', () => {
  return gulp
    .src(`validation-configs/imports`, {
      read: false,
      allowEmpty: true,
    })
    .pipe(clean());
});

gulp.task('pull-validation-configs-imports', () => {
  return gulp
    .src(`validation-configs/imports.json`)
    .pipe(loadFiles())
    .pipe(gulp.dest(`validation-configs/imports`));
});

gulp.task('update-validation-configs', gulp.series(
  'clean-validation-configs-imports',
  'pull-validation-configs-imports'
));



gulp.task('clean-validation-configs', () => {
  const env = process.env.ENV;
  return gulp
    .src(`environments/${env}/validation-configs-local`, {
      read: false,
      allowEmpty: true,
    })
    .pipe(clean());
});

gulp.task('get-validation-configs', () => {
  return gulp
    .src(`environments/${process.env.ENV}/validation-configs.json`)
    .pipe(loadFiles())
    .pipe(gulp.dest(`environments/${process.env.ENV}/validation-configs-local`));
});

/**
 * Returns a Transform stream that combines all incoming validation-config files into a single validation-config file.
 * It combines the aliases, rules and policies arrays.
 * @param {string} name name of the combined file
 * @returns {Transform}
 */
const combineValidationConfig = (name) => {
  return new Transform({
    objectMode: true,
    construct(callback) {
      this.aliases = [];
      this.rules = [];
      this.policies = [];
      callback();
    },
    transform(file, encoding, callback) {
      const validationSchema = jsyaml.loadAll(file.contents);

      validationSchema.forEach(({ rules = [], policies = [], aliases = [] }) => {
        this.aliases.push(...aliases);
        this.rules.push(...rules);
        this.policies.push(...policies);
      });

      callback();
    },
    flush(callback) {
      // validate
      const finalValidationSchema = {
        apiVersion: 'v1',
        aliases: this.aliases,
        rules: this.rules,
        policies: this.policies,
      };

      this.push(new Vinyl({
        path: name,
        contents: Buffer.from(jsyaml.dump(finalValidationSchema))
      }));
      callback();
    }
  })
}

gulp.task('pack-validation-configs', () => {
  const env = process.env.ENV;
  return gulp
    .src(`environments/${env}/validation-configs-local/**/*.yaml`)
    .pipe(combineValidationConfig('validation-config.yaml'))
    .pipe(gulp.dest(`environments/${env}/dist`));
});
