const app = require('./service.js');
const metrics = require('./metrics');
const logger = require('./logger.js');

app.use(metrics.requestTracker);
const logger = new Logger();
app.use(logger.httpLogger);

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
