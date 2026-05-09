const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middlewares/errorHandler');
const csrfProtection = require('./middlewares/csrf');
const authRoutes = require('./routes/authRoutes');
const pushRoutes = require('./routes/pushRoutes');
const callRoutes = require('./routes/callRoutes');
const roleRoutes = require('./routes/roleRoutes');
const planRoutes = require('./routes/planRoutes');
const languageRoutes = require('./routes/languageRoutes');
const timezoneRoutes = require('./routes/timezoneRoutes');
const platformRoutes = require('./routes/platformRoutes');
const messageMenuItemRoutes = require('./routes/messageMenuItemRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const designationRoutes = require('./routes/designationRoutes');
const locationRoutes = require('./routes/locationRoutes');
const orgUserRoutes = require('./routes/orgUserRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const globalAccessRoutes = require('./routes/globalAccessRoutes');
const groupRoutes = require('./routes/groupRoutes');
const groupMemberRoutes = require('./routes/groupMemberRoutes');
const groupTimelineRoutes = require('./routes/groupTimelineRoutes');
const organizationMessageMenuPermissionRoutes = require('./routes/organizationMessageMenuPermissionRoutes');
const planFeatureRoutes = require('./routes/planFeatureRoutes');
const siteDetailRoutes = require('./routes/siteDetailRoutes');
const productFeatureRoutes = require('./routes/productFeatureRoutes');
const contactUsRoutes = require('./routes/contactUsRoutes');
const organizationRestrictionRoutes = require('./routes/organizationRestrictionRoutes');
const billingRoutes = require('./routes/billingRoutes');
const geoRoutes = require('./routes/geoRoutes');
const couponRoutes = require('./routes/couponRoutes');
const paymentGatewayRoutes = require('./routes/paymentGatewayRoutes');
const smtpSettingsRoutes = require('./routes/smtpSettingsRoutes');
const liveAssistantRoutes = require('./routes/liveAssistantRoutes');
const organizationControlRoutes = require('./routes/organizationControlRoutes');
const chatRoutes = require('./chat/chatRoutes');
const organizationProfileRoutes = require('./routes/organizationProfileRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const translateRoutes = require('./routes/translateRoutes');
const aiProviderRoutes = require('./routes/aiProviderRoutes');
const gifRoutes = require('./routes/gifRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

const app = express();
// Behind Render / Vercel / nginx the real client IP arrives in
// X-Forwarded-For. Without trust proxy, express-rate-limit would key every
// request to the proxy's IP and either rate-limit everyone collectively or
// no one at all. Trust exactly one hop — the platform proxy in front of us.
app.set('trust proxy', 1);

const allowedOrigins = String(process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Dev convenience: allow localhost, local network IPs, and tunnel domains
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token', 'X-Device-Id'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(csrfProtection);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TeamChat API',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/push', pushRoutes);
app.use('/calls', callRoutes);
app.use('/roles', roleRoutes);
app.use('/plans', planRoutes);
app.use('/languages', languageRoutes);
app.use('/timezones', timezoneRoutes);
app.use('/platforms', platformRoutes);
app.use('/message-menu-items', messageMenuItemRoutes);
app.use('/departments', departmentRoutes);
app.use('/designations', designationRoutes);
app.use('/locations', locationRoutes);
app.use('/users', orgUserRoutes);
app.use('/activity-logs', activityLogRoutes);
app.use('/global-access', globalAccessRoutes);
app.use('/groups', groupRoutes);
app.use('/group-members', groupMemberRoutes);
app.use('/group-timeline', groupTimelineRoutes);
app.use('/organization-message-menu-permissions', organizationMessageMenuPermissionRoutes);
app.use('/plan-features', planFeatureRoutes);
app.use('/site-details', siteDetailRoutes);
app.use('/product-features', productFeatureRoutes);
app.use('/contact-us', contactUsRoutes);
app.use('/organization-restrictions', organizationRestrictionRoutes);
app.use('/billing', billingRoutes);
app.use('/geo', geoRoutes);
app.use('/coupons', couponRoutes);
app.use('/payment-gateways', paymentGatewayRoutes);
app.use('/smtp-settings', smtpSettingsRoutes);
app.use('/live-assistant', liveAssistantRoutes);
app.use('/organization-controls', organizationControlRoutes);
app.use('/chat', chatRoutes);
app.use('/organization', organizationProfileRoutes);
app.use('/upload', uploadRoutes);
app.use('/translate', translateRoutes);
app.use('/ai-providers', aiProviderRoutes);
app.use('/gifs', gifRoutes);
app.use('/meetings', meetingRoutes);


app.use((req, res, next) => {
  const error = new Error('Route not found');
  error.status = 404;
  next(error);
});

app.use(errorHandler);

module.exports = app;
