const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    const chunks = [];

    const originalWrite = res.write;
    const originalEnd = res.end;

    // Capture response stream
    res.write = function (chunk, ...args) {
      chunks.push(Buffer.from(chunk));
      return originalWrite.apply(this, [chunk, ...args]);
    };

    res.end = function (chunk, ...args) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      const body = Buffer.concat(chunks).toString('utf8');
      res.locals.responseBody = body;

      return originalEnd.apply(this, [chunk, ...args]);
    };

    // Log AFTER response is fully sent
    res.on('finish', () => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: this.safeJson(req.body),
        resBody: this.safeJson(res.locals.responseBody),
     };

      this.log(this.statusToLogLevel(res.statusCode), 'http', logData);
    });

    next();
  }

  safeJson(data) {
    try {
      return JSON.stringify(data);
    } catch {
      return '"[unserializable]"';
    }
  }  

  sqlLogHelper(query){
    this.log('info', 'db', { sqlQuery: query });
  }

  factoryLogHelper(res){
    this.log('info', 'factory', { statusCode: res.statusCode, statusMessage: res.statusMessage });
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