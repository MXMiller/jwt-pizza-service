const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    console.log("in httpLogger middleware");
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  }

  sqlLogHelper(query){
    this.log('info', 'db', { reqBody: query });
  }

  errLogHelper(err){
    this.log('error', 'error', { statusCode: err.statusCode ?? 500, resBody: err.message ?? 'error' });
  }

  factoryLogHelper(fReqUrl, fReqBody, fRes){
    this.log('info', 'factory', { path: fReqUrl, reqBody: fReqBody, resBody: fRes });
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
    const str = JSON.stringify(logData);
    return str
      .replace(/"password":\s*"[^"]*"/g, '"password":"*****"')
      .replace(/"jwt":\s*"[^"]*"/g, '"jwt":"*****"')
      .replace(/"token":\s*"[^"]*"/g, '"token":"*****"')
      .replace(/"authorization":\s*"[^"]*"/g, '"authorization":"*****"');
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