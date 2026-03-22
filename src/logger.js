const config = require('./config');

function httpLogger(req, res, next) {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = statusToLogLevel(res.statusCode);
      log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

function log(level, type, logData) {
  const labels = { component: config.logging.source, level: level, type: type };
  const values = [nowString(), sanitize(logData)];
  const logEvent = { streams: [{ stream: labels, values: [values] }] };

  sendLogToGrafana(logEvent);
}

function statusToLogLevel(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

function nowString() {
  return (Math.floor(Date.now()) * 1000000).toString();
}

function sanitize(logData) {
  logData = JSON.stringify(logData);
  return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
}

function sendLogToGrafana(event) {
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

module.exports = ( httpLogger );