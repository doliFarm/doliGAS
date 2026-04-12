// backend/utils/logger.js

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
	    info: (msg, data = null) => {
		            // Only verify stringify if data exists to keep logs clean
		            if (data) {
				                console.log(`[INFO] ${msg}`, JSON.stringify(data, null, 2));
				            } else {
						                console.log(`[INFO] ${msg}`);
						            }
		        },
	    
	    // Logs full error details to server console
	    error: (msg, error) => {
		            console.error(`[ERROR] ${msg}`);
		            if (error) {
				                // Log stack trace if available, otherwise the error object
				                console.error(error.stack || error);
				            }
		        },

	    // Sanitize error for frontend responses
	    sanitizeError: (error) => {
		            if (isDev) return error.message; // In dev, show details to frontend
		            return 'INTERNAL_SERVER_ERROR';  // In prod, hide details for security
		        }
};

module.exports = logger;
