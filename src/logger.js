const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    const logger = this;

    console.log('LOGGER HIT:', req.method, req.originalUrl);

    res.on('finish', () => {
      console.log('LOGGER FINISH:', res.statusCode);

      try {
        logger.log('info', 'http', {
          path: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
        });
      } catch (err) {
        console.log('Logging failed:', err.message);
      }
    });

    next();
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