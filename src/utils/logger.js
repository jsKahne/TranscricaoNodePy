import winston from 'winston';

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` | ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: 'debug', 
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    customFormat
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ]
});
