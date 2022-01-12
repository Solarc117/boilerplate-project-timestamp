// https://obscure-wave-43713.herokuapp.com/
('use strict');
function log() {
  console.log(...arguments);
}
function checkFormat(date) {
  if (typeof date !== 'string') return false;
  const [year, month, day] = date.split('-').map(num => +num);
  return year > 0 &&
    year < 9999 &&
    month > 0 &&
    month <= 12 &&
    day > 0 &&
    day <= 31 &&
    date.length === 10
    ? [year, month - 1, day]
    : false;
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
  UserSchema = new Schema({
    username: {
      type: String,
      required: true,
    },
    logs: [Object],
  }),
  User = mongoose.model('User', UserSchema),
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

// For indenting json responses.
app.set('json spaces', 2);

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

// 4. Exercise tracker.
app.post('/api/users', urlencodedParser, (req, res) => {
  // I am creating the user, then immediately responding w/the username and id of the new user.
  // But first, I need to check that username is not already taken (user will be null if username is free).
  // I believe user will be null if no user is found, in which case I should CREATE the new user.
  const { username } = req.body;
  User.findOne({ username: username }, (err, user) => {
    if (err) {
      log('❌ Error querying db for username: ' + err);
      return res.send('❌ Could not query db for username 😣');
    }
    if (user)
      return res.json({
        message: 'Someone already has that username 😥',
        username: user.username,
        _id: user._id,
      });
    const newUser = new User({
      username: username,
    });
    newUser.save((err, user) => {
      if (err) {
        log('❌ Error saving new user: ' + err);
        return res.send('❌ Could not create a new user 😣');
      }
      const { username, _id } = user;
      res.json({
        message: `Welcome, ${username}! Created new user 🎉🥳`,
        username: username,
        _id: _id,
      });
    });
  });
});

// 4. Exercise tracker - post a new exercise.
app.post('/api/users/:_id/exercises', urlencodedParser, (req, res) => {
  const { _id } = req.params;
  User.findById(_id, (err, user) => {
    if (err) {
      log('❌ Error querying db for user: ' + err);
      return res.send(
        '❌ Could not find a user corresponding to that _id, please try again'
      );
    }
    if (user) {
      const { description, duration, date } = req.body,
        test = checkFormat(date);
      if (!test && date !== '') {
        log('❌ Invalid date format: ' + date);
        return res.send(
          '❌ Invalid date format: ' +
            date +
            ' - please enter in yyyy-mm-dd format.'
        );
      }
      if (!+duration) {
        log('❌ Invalid duration format: ' + duration);
        return res.send(
          '❌ Invalid duration format: ' +
            duration +
            ' - please enter only integers.'
        );
      }
      user.logs.push({
        description: description,
        duration: +duration,
        // Date might still me '', meaning use the current date.
        date: date ? new Date(...test) : new Date(),
      });
      return user.save((err, user) => {
        if (err) {
          log('❌ Error saving exercise log: ' + err);
          return res.send('❌ Something went wrong');
        }
        if (user) {
          const { username, _id } = user,
            { description, duration, date } = user.logs[user.logs.length - 1];
          return res.json({
            username: username,
            _id: _id,
            date: date.toDateString(),
            duration: duration,
            description: description,
          });
        }
        return res.send('❌ Something went wrong');
      });
    }
    res.send('❌ Something went wrong');
  });
});

// 4. Exercise tracker - get all users.
app.get('/api/users', (req, res) => {
  User.find({}, (err, allUsers) => {
    if (err) {
      log('❌ Error fetching users: ' + err);
      return res.send('❌ Could not fetch users 😣');
    }
    if (allUsers) return res.send(allUsers);
    res.send([]);
  });
});

// 4. Exercise-tracker get all user's logs.
app.get('/api/users/:_id/logs', (req, res) => {
  const { from, to, limit } = req.query,
    { _id } = req.params;

  User.findById(_id, (err, user) => {
    if (err) {
      log('Error querying user by id: ' + err);
      return res.send('❌ Could not find a user with that id');
    }
    if (user) {
      // Now I checking if there were any queries; if there are, the first time I add them from the user's logs, and thereafter filter from the filteredLogs.
      let { logs } = user,
        // If the query was of a valid format, all of these checks should be truthy values.
        fromUnix = checkFormat(from),
        toUnix = checkFormat(to),
        limitCheck = +limit,
        message = '';

      if (from) {
        if (fromUnix) {
          fromUnix = new Date(...fromUnix).valueOf();
          logs = logs.filter(log => log.date.valueOf() >= fromUnix);
        } else message += '⚠️  Invalid from format, please enter yyyy-mm-dd\n';
      }
      if (to) {
        if (toUnix) {
          toUnix = new Date(...toUnix).valueOf();
          logs = logs.filter(log => log.date.valueOf() <= toUnix);
        } else message += '⚠️  Invalid to format - please enter yyyy-mm-dd';
      }
      if (limitCheck) {
        while (logs.length > limitCheck) logs.shift();
      } else if (limit)
        message += '⚠️  Invalid limit format - please enter digits only';

      logs.forEach(log => (log.date = log.date.toDateString()));
      user.count = logs.length;
      return res.json(user);
    }
    res.send('❌ No user by that id');
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

app.listen(port, () => log(`🚀 Listening on port ${port}`));
