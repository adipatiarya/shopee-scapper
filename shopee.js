const _cm = require('commander');
const _async = require('async');
const _colors = require('colors');
const request = require('request');
const requestPromise = require('request-promise');
const _proggers = require('cli-progress');
const fs = require('fs');
const path = require('path');
const _commander = new _cm.Command();

function strReplace(str) {
  str = str.replace(/\//g, '');
  return str;
}

const clacSize = (a, b) => {
  if (0 == a) return '0 Bytes';
  var c = 1024,
    d = b || 2,
    e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    f = Math.floor(Math.log(a) / Math.log(c));
  return parseFloat((a / Math.pow(c, f)).toFixed(d)) + ' ' + e[f];
};

exports.createFolder = async (name, callback, cb) => {
  // mkDirByPathSync(name);
  if (!fs.existsSync(name)) {
    fs.mkdirSync(name);
  }
  callback();
  cb(name);
};

const loadbar = new _proggers.Bar(
  {
    format:
      'Request => ' +
      _colors.green('{bar}') +
      ' {percentage}% | {current}/{size} | ETA: {eta}s | Speed: {speed}',
    barsize: 25,
  },
  _proggers.Presets.shades_classic
);
exports.getJson = async (u) => {
  return new Promise(async (resolve, reject) => {
    console.log('⏳  ' + _colors.yellow(`Download List images ${u}`));

    let body = '';
    let currentSize = 0;

    const req = await request.get(u);

    await req.on('response', (data) => {
      const size = parseInt(data.headers['content-length'], 10);

      loadbar.start(size, 0, {
        size: clacSize(size, 3),
        current: clacSize(currentSize, 3),
        speed: 0,
      });
      //console.log(data);
    });
    await req.on('data', (c) => {
      currentSize += c.length;
      loadbar.increment(c.length, {
        speed: clacSize(c.length),
        current: clacSize(currentSize, 3),
      });
      body += c;
      // console.log(d);
    });
    await req.on('end', () => {
      var parsed = JSON.parse(body);

      loadbar.stop();
      console.log('✅  ' + _colors.green('Success Read image list'));

      resolve(parsed);
      // console.log(parsed);
    });
    await req.on('error', () => {
      loadbar.stop();
      console.log('❎  ' + _colors.green('Error Reading Image list'));
      reject('ERR');
    });
  });
};
exports.DLFunc = async (folder, image, callback) => {
  const loadbar = new _proggers.Bar(
    {
      format:
        `${image}.jpg : ` +
        _colors.green('{bar}') +
        ' {percentage}% | {current}/{size} | ETA: {eta}s | Speed: {speed}',
      barsize: 25,
    },
    _proggers.Presets.shades_classic
  );
  const url = `https://cf.shopee.co.id/file/${image}_tn`;

  const req = await request.get(url);
  let currentSize = 0;
  console.log('🎁  ' + _colors.yellow('Start Download From URL : ' + url));
  console.log('⏳  ' + _colors.yellow('Waiting Server Response...'));

  //let dir = path.join(folder, album.id.toString());
  const writeStream = fs.createWriteStream(path.join(folder, `${image}.jpg`));
  await req.on('response', async (data) => {
    const size = parseInt(data.headers['content-length'], 10);

    loadbar.start(size, 0, {
      size: clacSize(size, 3),
      current: clacSize(currentSize, 3),
      speed: 0,
    });
  });
  await req.on('data', (c) => {
    currentSize += c.length;
    loadbar.increment(c.length, {
      speed: clacSize(c.length),
      current: clacSize(currentSize, 3),
    });
  });
  await req.on('end', () => {
    loadbar.stop();
    callback();
  });
  req.pipe(writeStream);
  //console.log(folder, image);
};
exports.GetLink = async (u, limit) => {
  console.log(
    '⏳  ' + _colors.yellow(`Get Page From : https://shopee.co.id/${u}`)
  );
  try {
    const options = {
      uri: 'https://shopee.co.id/api/v4/search/search_user',
      qs: {
        keyword: u,
      },

      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Connection: 'Keep-Alive',
        'User-Agent': 'okhttp/3.12.1',
      },
      json: true,
    };
    const res = await requestPromise(options);
    try {
      const url = res.data.users[0].shopid;
      console.log('✅  ' + _colors.green('Done'));
      return {
        error: false,
        url: `https://shopee.co.id/api/v4/recommend/recommend?bundle=shop_page_product_tab_main&limit=${limit}&shopid=${url}`,
      };
    } catch (error) {
      console.log('❎  ' + _colors.green('shopname not founds!!'));
      return { error: true };
    }
  } catch (error) {
    console.log('❎  ' + _colors.green(error));
    return { error: true, message: 'Error Get Page' };
  }
};

_commander
  .option('-s, --shopname <SHOPNAME>', 'Nama Pemilik lapak cth:apple_official')
  .option('-l, --limit <NUMBER>', 'Jumalah yang mau di download');
_commander
  .version(`🔨  Version: 1.0`, '-v, --version')
  .usage('--shopname apple_official --limit 10')
  .name('node shopee.js');
_commander.parse();

const options = _commander.opts();
if (Object.keys(options) < 1) {
  _commander.outputHelp();
  return;
}

if (!process.argv.slice(2).length) {
  _commander.outputHelp();
  return;
}

(async () => {
  const { shopname, limit } = options;
  try {
    const res = await exports.GetLink(shopname, limit);
    if (!res.error) {
      const url = res.url;
      try {
        const dataJson = await exports.getJson(url);
        // console.log('data json', dataJson.data.sections[1].data.item);
        try {
          const items = dataJson.data.sections[1].data.item;

          const images = items.map((item) => {
            // const { name, price, images } = items;
            return { name: item.name, price: item.price, images: item.images };
          });
          if (!fs.existsSync(shopname)) {
            fs.mkdirSync(shopname);
          }
          //  console.log(images);
          _async.eachSeries(
            images,
            (image, callback) => {
              const folder = path.resolve(
                __dirname,
                shopname,
                strReplace(image.name) +
                  '-Rp.' +
                  image.price.toString().slice(0, -5)
              );
              const images = image.images;
              exports.createFolder(folder.trim(), callback, (f) => {
                _async.eachSeries(
                  images,
                  (img, callback) => {
                    exports.DLFunc(f, img, callback);
                  },
                  () => {}
                );
              });
            },
            () => {}
          );
        } catch (error) {
          console.log('ERROR KODE 1');
        }
      } catch (error) {
        return;
      }
    }
  } catch (error) {
    return;
  }
})();
