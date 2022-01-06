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
  dns = require('dns'),
  mongodb = require('mongodb'),
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
  port = process.env.PORT || 3000;

// 📄 mongoose.connect(uri, { useNewUrlParser: true }) is the MINIMUM required to connect, but to work with future versions of mongoose (where Server Discovery and Monitoring engine are deprecated), we also pass the useUnifiedTopology key with a true value.
mongoose
  .connect(process.env.MONGO_URI, {
    // ⚠️ ADD YOUR URI TO A ROOT .ENV FILE
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
  log(`${method} ${path} - ${ip}`);
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

// 3. URL Shortener - redirect to corresponding url.
app.get('/api/shorturl/:url', (req, res) => {
  // Should redirect to the shorturl's corresponding url.
  const { url: shortUrl } = req.params;
  UrlPair.findOne({ short_url: shortUrl }, (err, urlDoc) => {
    if (err) return log('❌ Error querying urlPair: ' + err);
    if (urlDoc) {
      const { original_url: url } = urlDoc;
      return res.redirect(url.includes('https://') ? url : `https://${url}`);
    }
    res.json({ error: 'could not find that url 😣' });
  });
});

// 3. URL Shortener - submit new short_url request.
// It is recommended to add parsers specifically to the routes that need them, rather than on root level with app.use().
app.post('/api/shorturl', urlencodedParser, (req, res) => {
  const { url: submittedUrl } = req.body;
  dns.lookup(submittedUrl, err => {
    if (err) {
      log(`❌ Error looking up ${submittedUrl} with dns: `, err);
      return res.json({ error: 'Invalid url' });
    }
    UrlPair.findOne({ original_url: submittedUrl }, (err, urlPair) => {
      if (err) return log('❌ Error querying UrlPairs: ' + err);
      if (urlPair)
        return res.json({
          original_url: urlPair.original_url,
          short_url: urlPair.short_url,
        });
      UrlPair.estimatedDocumentCount((err, count) => {
        if (err) return log('❌ Error estimating UrlPair count: ' + err);
        const short_url = count + 1,
          pairDoc = new UrlPair({
            original_url: submittedUrl,
            short_url: short_url,
          });
        pairDoc
          .save()
          .then(urlDoc => {
            log('✅ New url document saved!');
            res.json(urlDoc);
          })
          .catch(err => log('❌ Error saving new url document: ' + err));
      });
    });
  });
});

app.listen(port, () => log('Your app is listening on port ' + port));
