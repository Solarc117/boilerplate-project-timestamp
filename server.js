// https://obscure-wave-43713.herokuapp.com/
('use strict');
function log() {
  console.log(...arguments);
}
// Load environment variables into process.env.
require('dotenv').config();

const express = require('express'),
  app = express(),
  // enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
  // so that your API is remotely testable by FCC
  cors = require('cors'),
  mongoose = require('mongoose'),
  { Schema } = mongoose,
  UrlPairSchema = new Schema({
    original_url: {
      type: String,
      required: true,
    },
    short_url: {
      type: String,
      required: true,
    },
  }),
  UrlPair = mongoose.model('UrlPair', UrlPairSchema),
  bodyParser = require('body-parser'),
  urlencodedParser = bodyParser.urlencoded({ extended: false }),
  port = process.env.PORT || 3000,
  dns = require('dns');

// 📄 mongoose.connect(uri, { useNewUrlParser: true }) is the MINIMUM required to connect, but to work with future versions of mongoose (where Server Discovery and Monitoring engine are deprecated), we also pass the useUnifiedTopology key with a true value.
mongoose
  .connect(process.env.MONGO_URI, {
    // ⚠️ ADD YOUR URI
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => log('🍃 first-cluster db connected!'))
  .catch(err => log('❌ first-cluster db connection error: ' + err));

// 📄 Express evaluates functions in the order they appear in the code. This is true for middleware too. If you want it to work for all the routes, it should be mounted before them.

app.use(cors({ optionsSuccessStatus: 200 })); // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// A root-level action logging middleware. Calling next() prevents server from pausing on requests.
app.use((req, res, next) => {
  const { method, path, ip } = req;
  log(`📄 ${method} ${path} - ${ip}`);
  next();
});

// File responses.
// http://expressjs.com/en/starter/basic-routing.html
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));
app.get('/timestamp', (req, res) =>
  res.sendFile(__dirname + '/views/timestamp.html')
);
app.get('/header-parser', (req, res) =>
  res.sendFile(__dirname + '/views/header-parser.html')
);
app.get('/url-shortener', (req, res) =>
  res.sendFile(__dirname + '/views/url-shortener.html')
);
app.get('/exercise-tracker', (req, res) =>
  res.sendFile(__dirname + '/views/exercise-tracker.html')
);
app.get('/file-metadata', (req, res) =>
  res.sendFile(__dirname + '/views/file-metadata.html')
);

// 1. Timestamp.
app.get('/api', (req, res) => {
  const date = new Date();
  res.json({
    unix: date.valueOf(),
    utc: date.toUTCString(),
  });
});

// 2. Request Header Parser.
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.socket.remoteAddress,
    language: req.headers['accept-language'],
    software: req.headers['user-agent'],
  });
});

// 3. URL Shortener - submit new short_url request.
// It is recommended to add parsers specifically to the routes that need them, rather than on root level with app.use().
app.post('/api/shorturl', urlencodedParser, (req, res) => {
  // Checking if url is valid w/new URL().
  log('POST request processing...');
  let submittedUrl = req.body.url,
    ip;
  try {
    const UrlObj = new URL(submittedUrl);
    ip = dns.lookup(UrlObj.host, (err, ip) => {
      if (err && err.code === 'ENOTFOUND') throw err;
      return ip;
    });
    submittedUrl = UrlObj.href;
  } catch (err) {
    log('❌ New url error: ' + err);
    return res.json({
      error: 'invalid url',
    });
  }
  log('Submitted url verified 😎: ' + submittedUrl + ' ' + ip);
  // Checking if that url already exists in db.
  UrlPair.findOne({ original_url: submittedUrl }, (err, urlDoc) => {
    if (err) {
      log('❌ Error searching db for url: ' + err);
      return res.send('Could not query db for that url 😭');
    }
    if (urlDoc) {
      const { original_url, short_url } = urlDoc;
      return res.json({
        message: 'Already have that url! 🤗',
        original_url: original_url,
        short_url: short_url,
      });
    }
    // If it doesn't exist, create a new doc and save it.
    log('🧐 Could not find urlDoc in db - creating new doc...');
    UrlPair.estimatedDocumentCount((err, count) => {
      if (err) {
        log('❌ Error counting UrlPair docs: ' + err);
        return res.json({ error: 'Could not add url to db 😩' });
      }
      const newUrl = new UrlPair({
        original_url: submittedUrl,
        short_url: count + 1,
      });
      newUrl.save((err, urlpair) => {
        if (err) {
          log('❌ Error saving new UrlPair to docs: ' + err);
          return res.send('Could not add url to db 😩 ');
        }
        log('✅ Documented new url!');
        res.json({
          message: '✅ Documented new url!',
          original_url: urlpair.original_url,
          short_url: urlpair.short_url,
        });
      });
    });
  });
});

// 3. URL Shortener - redirect to corresponding url.
app.get('/api/shorturl/:url', (req, res) => {
  const { url } = req.params;
  UrlPair.findOne({ short_url: url }, (err, urlDoc) => {
    if (err) {
      log('❌ Error finding url: ' + err);
      return res.send('Could not get that url 😣');
    }
    if (urlDoc) {
      const { original_url } = urlDoc;
      log('🚗 Redirecting to ' + original_url);
      return res.redirect(original_url);
    }
    res.send('Something went wrong 🤨');
  });
});

// 1. Timestamp.
app.get('/api/:date', (req, res) => {
  const routeParam = req.params.date,
    date = new Date(isNaN(+routeParam) ? routeParam : +routeParam);
  res.json(
    date.toUTCString() === 'Invalid Date'
      ? { error: 'Invalid Date' }
      : { unix: date.valueOf(), utc: date.toUTCString() }
  );
});

app.listen(port, () => log(`🚀 App listening on port ${port}`));
