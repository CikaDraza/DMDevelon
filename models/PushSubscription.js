import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// One document per browser/device push subscription. A user may have several.
const PushSubscriptionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', PushSubscriptionSchema);
