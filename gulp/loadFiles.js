/**
 * @fileoverview
 * Utility to copy files from the local file system or load them via URL - based on a json config file.
 */
const fetch = require('node-fetch');
const URL = require('url').URL;
const fs = require('fs/promises');
const path = require('path');
const through2 = require('through2');

const isUrl = str => {
  try {
    return !!new URL(str);
  } catch {
    return false;
  }
};

/**
 * Recursively read files in directory
 * @param {string} filePath
 * @returns {Array<{contents: string, filePath: string}>}
 */
const readLocalFiles = async filePath => {
  const fileStats = await fs.lstat(filePath);
  if (fileStats.isDirectory()) {
    const fileNames = await fs.readdir(filePath);
    const files = await Promise.all(fileNames.map(name => readLocalFiles(path.join(filePath, name))))
    return files.flat();
  } else {
    const contents = await fs.readFile(filePath);
    return {
      contents,
      filePath
    };
  }
};


const readExternalFile = async fileAddress => {
  const url = new URL(fileAddress);
  const res = await fetch(fileAddress);
  const contents = await res.text();
  return {
    contents,
    name: `${url.host}/${url.pathname}`,
    // name: fileAddress.substr(fileAddress.lastIndexOf('/') + 1),
  }
};

/**
 * Provides a transform function for gulp which takes a single json file and loads
 * the specified files either locally or from the url.
 * @example
 * fs.writeFileSync('file-list.json', JSON.stringify([
 *   {
 *     "source": "extensions/serverless"
 *   },
 *   {
 *     "source": "https://raw.githubusercontent.com/kyma-project/kyma/main/resources/telemetry/charts/operator/templates/logparser_busola_extension_cm.yaml"
 *   }
 * ]), 'utf8');
 * gulp
 *   .src(`file-list.json`)
 *   .pipe(loadFiles)
 *   .pipe(gulp.dest(`dist`));
 */
function loadFiles() {
  return through2.obj(async function (extensionsFile, _, cb) {
    const list = JSON.parse(extensionsFile.contents.toString());

    const requests = list.map(({ source }) => {
      if (isUrl(source)) {
        return readExternalFile(source);
      } else {
        return readLocalFiles(source);
      }
    });

    const results = (await Promise.all(requests.flat())).flat();

    results.forEach(({ contents, name, filePath }) => {
      const file = extensionsFile.clone();

      if (filePath) {
        file.base = null;
        file.path = filePath;
      }
      else {
        file.base = null;
        file.path = name;
      }

      file.contents = Buffer.from(contents);
      this.push(file);
    });
    cb();
  });
}

module.exports = {
  loadFiles
};
