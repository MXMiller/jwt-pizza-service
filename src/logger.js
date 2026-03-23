const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    const chunks = [];

    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function (chunk, ...args) {
      chunks.push(Buffer.from(chunk));
      return originalWrite.apply(this, [chunk, ...args]);
    };

    res.end = function (chunk, ...args) {
      if (chunk) chunks.push(Buffer.from(chunk));

      const rawBody = Buffer.concat(chunks).toString('utf8');

      res.locals.responseBody = rawBody;
      return originalEnd.apply(this, [chunk, ...args]);
    };

    res.on('finish', () => {
      const level = this.statusToLogLevel(res.statusCode);

      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(res.locals.responseBody),
      };

      this.log(level, 'http', logData);

      // 👇 optional: also print locally so you KNOW it's firing
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[HTTP ${level}]`, logData.path, res.statusCode);
      }
    });

    res.on('finish', () => {
      console.log('HTTP LOGGER FIRED', req.method, req.originalUrl, res.statusCode);
    });

    next();
  }

  sqlLogHelper(query){
    this.log('info', 'db', { sqlQuery: query });
  }

  factoryLogHelper(res){
    this.log('info', 'factory', { statusCode: res.statusCode, statusMessage: res.statusMessage, resBody: res.json() });
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"', 
      '\\"jwt\\": \\"*****\\"', '\\"token\\": \\"*****\\"');
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}

module.exports = new Logger();